/*
 * --------------------------------------------------------------------------
 * File: blockchain.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service responsible for interacting with the Cardano blockchain.
 * Handles NFT minting with metadata and retrieving transaction/asset data
 * using Mesh SDK and BlockfrostProvider.
 * --------------------------------------------------------------------------
 */
// NestJS Common Modules, Decorators, and Exceptions
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

// NestJS Config Module
import { ConfigService } from '@nestjs/config';

// Mesh SDK Core Library for blockchain interactions
import {
  BlockfrostProvider,
  MeshTxBuilder,
  MeshWallet,
  ForgeScript,
  resolveScriptHash,
  stringToHex,
  mConStr,
  type Data,
  type UTxO,
} from '@meshsdk/core';

// Mesh SDK Core CST Library for Plutus script operations
import { applyParamsToScript } from '@meshsdk/core-cst';

// Internal Data Transfer Objects (DTOs)
import { TransactionMetadataResponseDto } from './dto/transaction-metadata-response.dto';
import { NftDataResponseDto } from './dto/nft-data-response.dto';
import { BuildMintTxDto } from './dto/build-mint-tx.dto';
import { BuildMintTxResponseDto } from './dto/build-mint-tx-response.dto';

// Internal JSON data (Plutus blueprint)
import * as blueprint from './plutus.json';

// Internal Types
import { PlutusBlueprint, PlutusValidator } from './types/blueprint.type';

/**
 * Defines the structure for inspection NFT metadata, aligning with desired on-chain data.
 */
export interface InspectionNftMetadata {
  vehicleNumber: string;
  pdfHash: string;
}
interface Script {
  code: string;
  version: 'V3';
}
interface InspectionPolicy {
  policy: Script;
  policyId: string;
}

// Very small in-process mutex used to serialize operations per address.
// Not suitable for multi-instance deployments; replace with distributed lock if needed.
class SimpleMutex {
  private _locked = false;
  private _waiters: Array<() => void> = [];

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => this._waiters.push(resolve));
  }

  private release() {
    if (this._waiters.length > 0) {
      const next = this._waiters.shift();
      if (next) next();
    } else {
      this._locked = false;
    }
  }
}

@Injectable()
export class BlockchainService {
  // Lightweight in-process mutex to serialize operations per wallet address.
  // This prevents near-concurrent mint builders in the same process from
  // attempting to use the same UTXOs at the same time. For multi-instance
  // deployments you should replace this with a distributed lock (Redis, DB, etc.).
  private readonly addressLocks = new Map<string, SimpleMutex>();

  private getMutexForAddress(address: string) {
    let m = this.addressLocks.get(address);
    if (!m) {
      m = new SimpleMutex();
      this.addressLocks.set(address, m);
    }
    return m;
  }
  private readonly logger = new Logger(BlockchainService.name);
  private readonly blockfrostProvider: BlockfrostProvider;
  private readonly wallet: MeshWallet; // Use AppWallet type for better type safety
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly blockfrostBaseUrl: string;

  private readonly MAX_RETRIES = 5;
  private readonly INITIAL_RETRY_DELAY_MS = 1000; // 1 second
  // Submit-time retry controls: when submission fails due to stale inputs
  // (BadInputsUTxO / ValueNotConservedUTxO), attempt a limited number of
  // rebuild+resubmit attempts with exponential backoff.
  private readonly SUBMIT_MAX_RETRIES = 3;
  private readonly SUBMIT_INITIAL_DELAY_MS = 700; // ms
  // Minimum lovelace per individual UTXO to be considered usable for tx building.
  // This can be configured via environment using MIN_UTXO_LOVELACE (in lovelace)
  // or MIN_UTXO_ADA (in ADA). Defaults to 2 ADA.
  private readonly MIN_UTXO_LOVELACE: number;

  /**
   * Constructs the BlockchainService instance.
   * Initializes BlockfrostProvider and MeshWallet based on environment configuration.
   *
   * @param configService The NestJS ConfigService for accessing environment variables.
   * @throws Error if BLOCKFROST_ENV is unsupported or WALLET_SECRET_KEY is not set.
   */
  constructor(private configService: ConfigService) {
    // Determine Blockfrost environment and base URL
    const blockfrostEnv = this.configService.getOrThrow<
      'preview' | 'preprod' | 'mainnet'
    >('BLOCKFROST_ENV');
    this.blockfrostBaseUrl = `https://cardano-${blockfrostEnv}.blockfrost.io/api/v0`;
    this.logger.log(`Using Blockfrost environment: ${blockfrostEnv}`);

    // Initialize Blockfrost Provider
    this.apiKey = this.configService.getOrThrow<string>(
      `BLOCKFROST_API_KEY_${blockfrostEnv.toUpperCase()}`,
    );
    this.blockfrostProvider = new BlockfrostProvider(this.apiKey);
    this.logger.log('BlockfrostProvider Initialized.');

    // Initialize Wallet - Ensure WALLET_SECRET_KEY is set securely in .env
    // WARNING: Storing secret keys directly like this is NOT recommended for production.
    // Consider using secure key management solutions or backend wallets like Nami/Eternl with connector approach.
    this.secretKey = this.configService.getOrThrow<string>(
      `WALLET_SECRET_KEY_${blockfrostEnv.toUpperCase()}`,
    );

    if (!this.secretKey) {
      throw new Error(
        `WALLET_SECRET_KEY for environment ${blockfrostEnv} is not set!`,
      );
    }

    this.wallet = new MeshWallet({
      networkId: blockfrostEnv === 'mainnet' ? 1 : 0, // 0 for preprod/preview, 1 for mainnet
      fetcher: this.blockfrostProvider,
      submitter: this.blockfrostProvider,
      key: {
        type: 'root', // Assuming root key from bech32 string
        bech32: this.secretKey,
      },
      // Parameters can be added here if needed globally
    });
    this.logger.log('MeshWallet Initialized.');

    // Read per-UTXO minimum from configuration if provided
    const configuredMinLovelace =
      this.configService.get<number>('MIN_UTXO_LOVELACE');
    const configuredMinAda = this.configService.get<number>('MIN_UTXO_ADA');

    if (
      typeof configuredMinLovelace === 'number' &&
      !Number.isNaN(configuredMinLovelace)
    ) {
      this.MIN_UTXO_LOVELACE = Math.max(0, Math.floor(configuredMinLovelace));
    } else if (
      typeof configuredMinAda === 'number' &&
      !Number.isNaN(configuredMinAda)
    ) {
      this.MIN_UTXO_LOVELACE = Math.max(
        0,
        Math.floor(configuredMinAda * 1000000),
      );
    } else {
      this.MIN_UTXO_LOVELACE = 2000000; // default 2 ADA
    }

    this.logger.log(
      `Per-UTXO minimum set to ${this.MIN_UTXO_LOVELACE} lovelace (${(
        this.MIN_UTXO_LOVELACE / 1000000
      ).toFixed(6)} ADA)`,
    );
  }

  /**
   * Creates a new MeshTxBuilder instance configured with the service's provider.
   *
   * @returns A new instance of MeshTxBuilder.
   */
  private getTxBuilder(): MeshTxBuilder {
    return new MeshTxBuilder({
      fetcher: this.blockfrostProvider,
      submitter: this.blockfrostProvider,
      // Parameters can be added here if needed globally
    });
  }

  /**
   * Mints a new NFT on Cardano with provided inspection metadata.
   * Uses the wallet configured in the service to build, sign, and submit the transaction.
   *
   * @param metadata The metadata object to embed in the NFT.
   * @returns A promise that resolves to an object containing the transaction hash and the full asset ID (policyId + hexName).
   * @throws InternalServerErrorException If minting fails.
   * @throws BadRequestException If required metadata fields are missing.
   */
  async mintInspectionNft(
    metadata: InspectionNftMetadata,
  ): Promise<{ txHash: string; assetId: string }> {
    this.logger.log(
      `Attempting to mint NFT for vehicle: ${metadata.vehicleNumber}`,
    );

    // Add random delay to prevent UTXO conflicts in concurrent minting
    const randomDelay = Math.random() * 2000; // 0-2 seconds
    await new Promise((resolve) => setTimeout(resolve, randomDelay));
    this.logger.debug(
      `Applied ${Math.round(randomDelay)}ms delay before minting to prevent UTXO conflicts`,
    );

    let retries = 0;
    let delay = this.INITIAL_RETRY_DELAY_MS;

    while (retries < this.MAX_RETRIES) {
      try {
        const lovelaceAmount = parseInt(await this.wallet.getLovelace(), 10);
        const balanceInAda = lovelaceAmount / 1000000;

        // 5 ADA = 5,000,000 lovelace
        if (lovelaceAmount < 5000000) {
          throw new BadRequestException(
            `Wallet has not enough funds or the balance is insufficient. Current balance: ${balanceInAda.toFixed(
              6,
            )} ADA.`,
          );
        }
        this.logger.debug(`Current balance: ${balanceInAda.toFixed(6)} ADA.`);

        // Get the primary address early so we can fallback to Blockfrost
        // if the wallet SDK returns UTXOs without amount fields.
        const walletAddress = (await this.wallet.getUsedAddresses())[0];

        // Serialize the UTXO selection and transaction build/sign/submit for this address
        // to avoid race conditions when two near-concurrent requests try to use the
        // same UTXOs. This is an in-process mutex — for multi-instance deployments
        // replace with a distributed lock.
        const mutex = this.getMutexForAddress(walletAddress);

        // Execute the core mint operation under the mutex
        const result = await mutex.runExclusive(async () => {
          // Use getUnspentOutputs to ensure we only work with UTXOs that are
          // unspent and available for building new transactions (safer for parallel
          // transaction builds and avoids attempting to use locked/invalid UTXOs).
          const utxos = await this.wallet.getUnspentOutputs();

          // Basic validation: must be a non-empty array
          if (!Array.isArray(utxos) || utxos.length === 0) {
            throw new InternalServerErrorException(
              'Wallet has no unspent outputs available to build the transaction.',
            );
          }

          // Stronger, more tolerant UTXO parsing: support different shapes that
          // various wallet implementations or providers may return. We try to
          // extract a lovelace amount from the returned utxo in several ways.
          type AssetAmount = { unit?: string; quantity?: string | number };
          type TxOutput = {
            address?: string;
            amount?: AssetAmount[] | Record<string, unknown> | string | number;
          };

          const extractLovelace = (rawUtxo: unknown): number | null => {
            if (!rawUtxo || typeof rawUtxo !== 'object') return null;

            const tx = rawUtxo as { output?: TxOutput | (() => TxOutput) };
            const output =
              typeof tx.output === 'function' ? tx.output() : tx.output;
            if (!output) return null;

            const amt = (output as TxOutput).amount;

            // Case 1: amount is an array of { unit, quantity }
            if (Array.isArray(amt)) {
              const lov = (amt as Array<any>).find(
                (a) => a && String(a.unit).toLowerCase() === 'lovelace',
              );
              if (lov && lov.quantity !== undefined && lov.quantity !== null) {
                const n = Number(lov.quantity);
                if (!Number.isNaN(n)) return Math.floor(n);
              }
            }

            // Case 2: amount is a map/object like { lovelace: '12345', "policy...": '1' }
            if (amt && typeof amt === 'object' && !Array.isArray(amt)) {
              const asObj = amt as Record<string, unknown>;
              if (Object.prototype.hasOwnProperty.call(asObj, 'lovelace')) {
                const v = asObj['lovelace'];
                const n = Number(v);
                if (!Number.isNaN(n)) return Math.floor(n);
              }
            }

            // Case 3: amount is a raw number or numeric string
            if (typeof amt === 'number') return Math.floor(amt);
            if (typeof amt === 'string') {
              const n = Number(amt);
              if (!Number.isNaN(n)) return Math.floor(n);
            }

            return null;
          };

          // Compatibility: some wallets return empty/minimal objects from
          // getUnspentOutputs(). In that case try the older `getUtxos()` API
          // which sometimes returns richer TransactionUnspentOutput objects.
          const looksLikeMinimal =
            Array.isArray(utxos) &&
            utxos.length > 0 &&
            utxos.every(
              (u) =>
                u &&
                typeof u === 'object' &&
                Object.keys(u as object).length === 0,
            );
          if (
            looksLikeMinimal &&
            typeof (this.wallet as any).getUtxos === 'function'
          ) {
            try {
              this.logger.debug(
                'getUnspentOutputs returned minimal objects; trying wallet.getUtxos() fallback',
              );
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore - dynamic fallback for compatibility
              const compat = await (this.wallet as any).getUtxos();
              if (Array.isArray(compat) && compat.length > 0) {
                this.logger.debug(
                  `wallet.getUtxos() returned ${compat.length} entries, using those for selection`,
                );
                // replace utxos with richer representation
                // cast to unknown so downstream parsing is tolerant
                (utxos as unknown) = compat as unknown;
              }
            } catch {
              this.logger.debug('wallet.getUtxos() fallback failed');
            }
          }

          // Annotate each utxo with parsed lovelace for easier downstream use
          let utxosWithLovelace: Array<{
            raw: unknown;
            lovelace: number | null;
          }> = utxos.map((u) => ({
            raw: u as unknown,
            lovelace: extractLovelace(u),
          }));

          let usableUtxos = utxosWithLovelace
            .filter(
              (x) =>
                typeof x.lovelace === 'number' &&
                x.lovelace >= this.MIN_UTXO_LOVELACE,
            )
            .map((x) => x.raw);

          // If the wallet SDK returned UTXOs but none had amount info (parsedLovelace === null)
          // attempt a fallback: fetch full UTXO list from Blockfrost for the wallet address
          // and retry parsing/selecting. This covers providers that return minimal UTXO shapes.
          const allParsedNull = utxosWithLovelace.every(
            (x) => x.lovelace === null,
          );
          if (
            (usableUtxos.length === 0 || !Array.isArray(usableUtxos)) &&
            allParsedNull
          ) {
            try {
              this.logger.debug(
                'Wallet unspent outputs lack amount info; attempting Blockfrost fallback fetch for address: ' +
                  walletAddress,
              );
              const fallbackUtxos =
                await this.blockfrostProvider.fetchAddressUTxOs(walletAddress);
              if (Array.isArray(fallbackUtxos) && fallbackUtxos.length > 0) {
                // Cast fallback results to unknown so our local type matches regardless
                // of mesh/core specific TransactionUnspentOutput wrapper types.
                utxosWithLovelace = (
                  fallbackUtxos as unknown as Array<unknown>
                ).map(
                  (u) => ({ raw: u, lovelace: extractLovelace(u) }) as const,
                );
                usableUtxos = utxosWithLovelace
                  .filter(
                    (x) =>
                      typeof x.lovelace === 'number' &&
                      x.lovelace >= this.MIN_UTXO_LOVELACE,
                  )
                  .map((x) => x.raw);

                this.logger.debug(
                  `Blockfrost fallback returned ${fallbackUtxos.length} UTXOs, usable after filter=${usableUtxos.length}`,
                );
              } else {
                this.logger.debug('Blockfrost fallback returned no UTXOs.');
              }
            } catch {
              this.logger.debug('Blockfrost fallback failed');
            }
          }

          if (!Array.isArray(usableUtxos) || usableUtxos.length === 0) {
            // Helpful debug: aggregate balance may be sufficient, but none of the
            // individual returned unspent outputs meet the per-UTXO minimum used
            // by the builder (we filtered for >= 2 ADA). This can happen when
            // balance is composed of many small UTXOs or when the wallet returned
            // empty/minimal UTXO objects.
            this.logger.debug(
              `No usable unspent outputs found: total returned UTXOs=${utxos.length}, usable=${usableUtxos.length}, aggregateBalance=${balanceInAda.toFixed(6)} ADA`,
            );

            try {
              // Log first few returned UTXOs with parsed lovelace to help debugging
              const samples = utxosWithLovelace.slice(0, 5).map((x) => {
                let repr: string;
                try {
                  repr = JSON.stringify(x.raw);
                } catch {
                  repr = String(x.raw);
                }
                // Truncate long JSON
                if (repr.length > 1000) repr = repr.slice(0, 1000) + '...';
                return { parsedLovelace: x.lovelace, raw: repr };
              });
              this.logger.debug(
                `Returned UTXO samples: ${JSON.stringify(samples)}`,
              );
            } catch {
              this.logger.debug(
                'Failed to stringify UTXO samples for debugging.',
              );
            }

            throw new InternalServerErrorException(
              `No unspent outputs meet the per-UTXO minimum (${(
                this.MIN_UTXO_LOVELACE / 1000000
              ).toFixed(
                6,
              )} ADA). Wallet aggregate balance: ${balanceInAda.toFixed(6)} ADA. Returned UTXOs: ${utxos.length}. Usable (>=${(
                this.MIN_UTXO_LOVELACE / 1000000
              ).toFixed(
                6,
              )} ADA): ${usableUtxos.length}. Consider consolidating UTXOs or relaxing the per-UTXO filter if appropriate.`,
            );
          }

          this.logger.debug(
            `Found ${utxos.length} total UTXOs, ${usableUtxos.length} usable UTXOs for wallet.`,
          );

          // Convert TransactionUnspentOutput-like objects to the plain UTxO shape
          // expected by MeshTxBuilder.selectUtxosFrom. Some implementations expose
          // `input`/`output` as functions, others as plain objects; handle both.
          type TxLike = {
            input:
              | { txHash: string; outputIndex: number }
              | (() => { txHash: string; outputIndex: number });
            output: Record<string, unknown> | (() => Record<string, unknown>);
          };

          const meshUtxos = usableUtxos.map((u: unknown) => {
            const tx = u as TxLike;
            const inputObj =
              typeof tx.input === 'function' ? tx.input() : tx.input;
            const outputObj =
              typeof tx.output === 'function' ? tx.output() : tx.output;

            // We keep output as unknown and cast only at the return site to avoid
            // unsafe `any` leakage across the function.
            return {
              input: {
                txHash: inputObj.txHash,
                outputIndex: inputObj.outputIndex,
              },
              output: outputObj as unknown,
            } as const;
          });

          // Wallet address was retrieved earlier and stored in `walletAddress`.

          // Define the forging script (single signature from the wallet owner)
          const forgingScript = ForgeScript.withOneSignature(walletAddress);
          const policyId = resolveScriptHash(forgingScript); // Calculate the policy ID

          // Generate a unique token name based on key inspection data + perhaps a random element or timestamp for uniqueness assurance
          const simpleAssetName = `Inspection_${metadata.vehicleNumber}`;
          const simpleAssetNameHex = stringToHex(simpleAssetName); // Convert human-readable name to hex
          // Construct the full asset ID
          const assetId = policyId + simpleAssetNameHex;
          this.logger.log(`Generated Asset ID: ${assetId}`);

          // Prepare the metadata according to CIP-0025 (NFT standard) under the 721 label
          // Ensure 'name' is set for display purposes
          const nftDisplayName = `CarInspection-${metadata.vehicleNumber}`; // Use provided name or generate one
          const imageForDisplay = `ipfs://QmY65h6y6zUoJjN3ripc4J2PzEvzL2VkiVXz3sCZboqPJw`; // Use provided name or generate one
          const finalMetadata = {
            ...metadata,
            name: nftDisplayName,
            image: imageForDisplay, // logo CAR-dano
            mediaType: 'image/png',
          }; // Add/overwrite name
          // Structure for CIP-0025: { policyId: { assetName: { metadata } } }
          const cip25Metadata = {
            [policyId]: { [simpleAssetName]: finalMetadata },
          }; // Use the human-readable asset name as the key in metadata

          // Initialize the transaction builder
          const txBuilder = this.getTxBuilder();

          // Build the transaction
          const unsignedTx = await txBuilder
            .mint('1', policyId, simpleAssetNameHex) // Mint 1 token with the calculated details (using hex asset name)
            .mintingScript(forgingScript) // Provide the script needed to authorize the mint
            .metadataValue('721', cip25Metadata) // Attach metadata under the 721 label
            .changeAddress(walletAddress) // Where to send remaining ADA and change
            .selectUtxosFrom(meshUtxos as unknown as UTxO[]) // Provide the filtered and-mapped UTXOs to use for inputs/fees
            .complete(); // Calculate fees and build the transaction body

          this.logger.log('Transaction built successfully. Signing...');

          // Sign the transaction
          let signedTx = await this.wallet.signTx(unsignedTx, true); // Partial sign might be false if wallet holds all keys
          this.logger.log('Transaction signed successfully. Submitting...');

          // Submit the transaction with submit-time retry for Cardano validation
          // errors that indicate stale or already-spent inputs. On such errors
          // we attempt to rebuild the transaction with fresh UTXO selection
          // and resubmit up to SUBMIT_MAX_RETRIES times.
          let submitAttempts = 0;
          let submitDelay = this.SUBMIT_INITIAL_DELAY_MS;
          while (true) {
            try {
              const txHash = await this.wallet.submitTx(signedTx);
              this.logger.log(
                `Transaction submitted successfully. TxHash: ${txHash}`,
              );
              return { txHash, assetId };
            } catch (submitErr: unknown) {
              submitAttempts += 1;

              // Normalize message for detection
              let submitMessage = '';
              if (submitErr instanceof Error) submitMessage = submitErr.message;
              else if (
                typeof submitErr === 'object' &&
                submitErr !== null &&
                'message' in submitErr &&
                typeof (submitErr as any).message === 'string'
              ) {
                submitMessage = (submitErr as any).message;
              } else {
                submitMessage = String(submitErr);
              }

              const isCardanoValidationError =
                submitMessage.includes('BadInputsUTxO') ||
                submitMessage.includes('ValueNotConservedUTxO') ||
                submitMessage.includes('BadInputs') ||
                submitMessage.includes('ValueNotConserved');

              if (
                isCardanoValidationError &&
                submitAttempts <= this.SUBMIT_MAX_RETRIES
              ) {
                this.logger.warn(
                  `Submit failed with Cardano validation error (${submitMessage}). Attempting rebuild+resubmit (${submitAttempts}/${this.SUBMIT_MAX_RETRIES}) after ${submitDelay}ms...`,
                );
                // Wait a bit before retrying to allow mempool/chain to settle
                // and to reduce tight loops.
                await new Promise((r) => setTimeout(r, submitDelay));
                submitDelay *= 2;

                // Re-fetch UTXOs from Blockfrost (authoritative) and rebuild the tx
                // using the same high-level steps as earlier: select fresh usableUtxos,
                // construct meshUtxos, complete the tx, sign and loop to submit.
                try {
                  const freshUtxos =
                    await this.blockfrostProvider.fetchAddressUTxOs(
                      walletAddress,
                    );
                  if (!Array.isArray(freshUtxos) || freshUtxos.length === 0) {
                    this.logger.warn(
                      'Blockfrost returned no UTXOs on resubmit attempt',
                    );
                    // Let the outer loop handle retry/backoff if appropriate
                    throw submitErr;
                  }

                  // Re-parse and select usable outputs
                  const freshParsed = (
                    freshUtxos as unknown as Array<unknown>
                  ).map((u) => ({ raw: u, lovelace: extractLovelace(u) }));
                  const freshUsable = freshParsed
                    .filter(
                      (x) =>
                        typeof x.lovelace === 'number' &&
                        x.lovelace >= this.MIN_UTXO_LOVELACE,
                    )
                    .map((x) => x.raw);

                  if (!Array.isArray(freshUsable) || freshUsable.length === 0) {
                    this.logger.warn(
                      'No usable UTXOs found on resubmit attempt',
                    );
                    throw submitErr;
                  }

                  const freshMeshUtxos = freshUsable.map((u: unknown) => {
                    const tx = u as any;
                    const inputObj =
                      typeof tx.input === 'function' ? tx.input() : tx.input;
                    const outputObj =
                      typeof tx.output === 'function' ? tx.output() : tx.output;
                    return {
                      input: {
                        txHash: inputObj.txHash,
                        outputIndex: inputObj.outputIndex,
                      },
                      output: outputObj as unknown,
                    } as const;
                  });

                  // Rebuild unsignedTx with fresh inputs
                  // Note: reuse same forgingScript, policyId, simpleAssetNameHex, cip25Metadata
                  // which are in scope here.
                  const newUnsigned = await this.getTxBuilder()
                    .mint('1', policyId, simpleAssetNameHex)
                    .mintingScript(forgingScript)
                    .metadataValue('721', cip25Metadata)
                    .changeAddress(walletAddress)
                    .selectUtxosFrom(freshMeshUtxos as unknown as UTxO[])
                    .complete();

                  const newSigned = await this.wallet.signTx(newUnsigned, true);
                  // replace signedTx and continue to submit in next loop iteration
                  // so that errors are caught and handled uniformly
                  // assign to signedTx variable visible in this closure
                  // mutate outer variable for retry
                  signedTx = newSigned;
                  continue; // next loop will attempt submitTx again
                } catch (rebuildErr) {
                  this.logger.warn(
                    'Rebuild+resubmit attempt failed',
                    rebuildErr,
                  );
                  // If we exhausted submit attempts, bubble up
                  if (submitAttempts >= this.SUBMIT_MAX_RETRIES)
                    throw submitErr;
                  // otherwise, allow the loop to retry
                  continue;
                }
              }

              // Not a recognized Cardano validation error or retries exhausted
              this.logger.error('Transaction submission failed:', submitErr);
              throw submitErr;
            }
          }
        });

        return result;
      } catch (error: unknown) {
        let errorMessage = 'Unknown error during minting';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ) {
          errorMessage = (error as { message: string }).message;
        }

        if (
          (errorMessage.includes('unspent outputs') ||
            errorMessage.includes('UTXOs') ||
            errorMessage.includes('UTXO')) &&
          retries < this.MAX_RETRIES - 1
        ) {
          this.logger.warn(
            `UTXO error encountered. Retrying in ${delay}ms... (Attempt ${
              retries + 1
            }/${this.MAX_RETRIES})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          retries++;
        } else {
          this.logger.error('NFT Minting failed:', error);
          throw new InternalServerErrorException(
            `Failed to mint NFT: ${errorMessage}`,
          );
        }
      }
    }
    throw new InternalServerErrorException(
      `Failed to mint NFT after ${this.MAX_RETRIES} retries due to UTXO unavailability.`,
    );
  }

  /**
   * Retrieves transaction metadata from Blockfrost using the transaction hash.
   *
   * @param txHash The hash of the Cardano transaction.
   * @returns A promise that resolves to an array of TransactionMetadataResponseDto.
   * @throws BadRequestException if the transaction hash is missing.
   * @throws NotFoundException if the transaction or metadata is not found.
   * @throws InternalServerErrorException for Blockfrost API or other errors.
   */
  async getTransactionMetadata(
    txHash: string,
  ): Promise<TransactionMetadataResponseDto[]> {
    this.logger.log(`Retrieving metadata for TxHash: ${txHash}`);
    if (!txHash) throw new BadRequestException('Transaction hash is required.');

    try {
      // Use the underlying BlockfrostProvider fetcher
      const metadataResponse = await fetch(
        `${this.blockfrostBaseUrl}/txs/${txHash}/metadata`,
        {
          headers: {
            project_id: this.apiKey,
          },
        },
      );

      if (!metadataResponse.ok) {
        if (metadataResponse.status === 404) {
          throw new NotFoundException(
            `No metadata found for transaction hash ${txHash}`,
          );
        }
        throw new Error(
          `Blockfrost API returned status ${metadataResponse.status}`,
        );
      }

      const metadata =
        (await metadataResponse.json()) as TransactionMetadataResponseDto[];

      this.logger.log(`Metadata retrieved successfully for TxHash: ${txHash}`);
      return metadata;
    } catch (error: unknown) {
      let errorMessage = 'Unknown error during metadata retrieval';
      let errorStack: string | undefined = undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ) {
        errorMessage = error.message;
        if ('stack' in error && typeof error.stack === 'string') {
          errorStack = error.stack;
        }
      }

      this.logger.error(
        `Failed to retrieve metadata for TxHash ${txHash}: ${errorMessage}`,
        errorStack,
      );

      if (
        (typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string' &&
          error.message.includes('404')) ||
        (typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof (error as { status: unknown }).status === 'number' &&
          (error as { status: number }).status === 404)
      ) {
        throw new NotFoundException(
          `Transaction or metadata not found for hash ${txHash}.`,
        );
      }

      throw new InternalServerErrorException(
        `Failed to retrieve transaction metadata: ${errorMessage}`,
      );
    }
  }

  /**
   * Retrieves asset details (including on-chain metadata if available) from Blockfrost using the asset ID.
   *
   * @param assetId The full asset ID (PolicyID + HexAssetName).
   * @returns A promise that resolves to an NftDataResponseDto.
   * @throws NotFoundException If the asset is not found.
   * @throws InternalServerErrorException For Blockfrost API or other errors.
   */
  async getNftData(assetId: string): Promise<NftDataResponseDto> {
    this.logger.log(`Retrieving data for Asset ID: ${assetId}`);
    if (!assetId) throw new BadRequestException('Asset ID is required.');

    try {
      // Fetch asset details including on-chain metadata from Blockfrost
      const assetResponse = await fetch(
        `${this.blockfrostBaseUrl}/assets/${assetId}`,
        {
          headers: {
            project_id: this.apiKey,
          },
        },
      );

      if (!assetResponse.ok) {
        // Check for 404 specifically
        if (assetResponse.status === 404) {
          throw new NotFoundException(`Asset not found for ID ${assetId}.`);
        }
        throw new Error(
          `Blockfrost API returned status ${assetResponse.status}`,
        );
      }

      const assetData = (await assetResponse.json()) as NftDataResponseDto;

      this.logger.log(
        `Asset data retrieved successfully for Asset ID: ${assetId}`,
      );

      // The 'onchain_metadata' property usually holds the CIP-25 metadata
      return assetData; // Return the full asset data object
    } catch (error: unknown) {
      let errorMessage = 'Unknown error during metadata retrieval';
      let errorStack: string | undefined = undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      } else if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ) {
        errorMessage = error.message;
        if ('stack' in error && typeof error.stack === 'string') {
          errorStack = error.stack;
        }
      }

      this.logger.error(
        `Failed to retrieve asset data for Asset ID ${assetId}: ${errorMessage}`,
        errorStack,
      );
      // Re-throw NotFoundException if it was caught
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Check for 404 specifically from Blockfrost error message if not already caught
      if (
        (typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string' &&
          error.message.includes('404')) ||
        (typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof (error as { status: unknown }).status === 'number' &&
          (error as { status: number }).status === 404)
      ) {
        throw new NotFoundException(`Asset not found for ID ${assetId}.`);
      }
      throw new InternalServerErrorException(
        `Failed to retrieve asset data: ${errorMessage}`,
      );
    }
  }

  /**
   * Builds an unsigned transaction for minting NFT using an Aiken Smart Contract.
   * This function does not sign or submit the transaction.
   *
   * @param buildMintTxDto Data containing the admin address and inspection details.
   * @returns A promise that resolves to an object containing the unsigned transaction CBOR and the NFT asset ID.
   * @throws NotFoundException if no UTXOs are available at the admin address.
   * @throws BadRequestException if at least two UTXOs are not available for input and collateral.
   * @throws InternalServerErrorException if building the transaction fails or the Aiken validator is not found.
   */
  async buildAikenMintTransaction(
    buildMintTxDto: BuildMintTxDto,
  ): Promise<BuildMintTxResponseDto> {
    const { adminAddress, inspectionData } = buildMintTxDto;

    this.logger.log(
      `Starting to build Aiken transaction for admin: ${adminAddress}`,
    );

    try {
      // 1. Get admin's UTXO from Blockfrost
      // In the new architecture, the frontend should ideally send the UTXO to be used
      // However, for now, we will fetch it in the backend.
      const utxos =
        await this.blockfrostProvider.fetchAddressUTxOs(adminAddress);
      if (utxos.length === 0) {
        throw new NotFoundException('No UTXOs available at the admin address.');
      }
      const refUtxo = utxos[0];

      // 2. Prepare policy and redeemer using Aiken logic
      const { policy, policyId } = this.getParameterizedPolicy(
        refUtxo.input.txHash,
        refUtxo.input.outputIndex,
      );
      const mintRedeemer = this.constructMintRedeemer();

      // 3. Prepare metadata and asset name
      const assetName = inspectionData.nftDisplayName;
      const assetNameHex = stringToHex(assetName);
      const nftAssetId = `${policyId}${assetNameHex}`;
      const imageForDisplay = `ipfs://QmY65h6y6zUoJjN3ripc4J2PzEvzL2VkiVXz3sCZboqPJw`; // CAR-dano's Logo

      const metadata = {
        '721': {
          [policyId]: {
            [assetName]: {
              name: assetName,
              image: imageForDisplay,
              mediaType: 'image/png',
              description: 'NFT Proof of Vehicle Inspection',
              vehicleNumber: inspectionData.vehicleNumber,
              pdfHash: inspectionData.pdfHash,
            },
          },
        },
      };

      // 4. Initialize MeshTxBuilder
      const txBuilder = this.getTxBuilder();

      // For collateral, we need a different UTXO from refUtxo
      const collateralUtxo = utxos.find(
        (u) => u.input.txHash !== refUtxo.input.txHash,
      );
      if (!collateralUtxo) {
        throw new BadRequestException(
          'Requires at least 2 UTXOs at the admin address (for input and collateral).',
        );
      }

      // 5. Build the transaction
      const unsignedTx = await txBuilder
        .txIn(
          refUtxo.input.txHash,
          refUtxo.input.outputIndex,
          refUtxo.output.amount,
          refUtxo.output.address,
        )
        .mintPlutusScriptV3()
        .mint('1', policyId, assetNameHex)
        .mintingScript(policy.code)
        .mintRedeemerValue(mintRedeemer)
        .metadataValue('721', metadata['721'])
        .txOut(adminAddress, [{ unit: nftAssetId, quantity: '1' }])
        .txInCollateral(
          collateralUtxo.input.txHash,
          collateralUtxo.input.outputIndex,
          collateralUtxo.output.amount,
          collateralUtxo.output.address,
        )
        .changeAddress(adminAddress)
        .selectUtxosFrom(utxos)
        .complete();

      this.logger.log(
        `Unsigned transaction (Aiken) built successfully. Asset ID: ${nftAssetId}`,
      );

      return { unsignedTx, nftAssetId };
    } catch (error: unknown) {
      this.logger.error(
        'Failed to build Aiken minting transaction. Displaying error details:',
      );
      if (error instanceof Error) {
        this.logger.error(`Error Message: ${error.message}`);
        this.logger.error(`Stack Trace: ${error.stack}`);
      } else if (typeof error === 'object' && error !== null) {
        if ('info' in error) {
          this.logger.error('Error Info:', (error as { info: any }).info);
        }
        if ('message' in error) {
          this.logger.error(
            'Error Message:',
            (error as { message: any }).message,
          );
        }
        this.logger.error(
          'Full Error Object (JSON):',
          JSON.stringify(error, null, 2),
        );
      } else {
        this.logger.error('Unknown Error:', error);
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to process minting request with Aiken.',
      );
    }
  }

  /**
   * Retrieves the parameterized policy script and policy ID for the Aiken minting policy.
   * The policy is parameterized with a reference UTXO.
   *
   * @param txHash The transaction hash of the reference UTXO.
   * @param outputIndex The output index of the reference UTXO.
   * @returns An object containing the parameterized policy script and its policy ID.
   */
  private getParameterizedPolicy(
    txHash: string,
    outputIndex: number,
  ): InspectionPolicy {
    const validator = this.getAikenValidator();
    const utxoRefAsData = mConStr(0, [txHash, BigInt(outputIndex)]);
    const parameterizedScriptCbor = applyParamsToScript(
      validator.compiledCode,
      [utxoRefAsData],
    );
    const policy: Script = { code: parameterizedScriptCbor, version: 'V3' };
    const policyId = resolveScriptHash(parameterizedScriptCbor, 'V3');
    return { policy, policyId };
  }

  /**
   * Constructs the mint redeemer for the Aiken minting policy.
   *
   * @returns The mint redeemer as Data.
   */
  private constructMintRedeemer(): Data {
    return mConStr(0, []);
  }

  /**
   * Retrieves the Aiken validator from the plutus.json blueprint.
   *
   * @returns The PlutusValidator for the inspection minting policy.
   * @throws InternalServerErrorException if the required validator is not found in plutus.json.
   */
  private getAikenValidator(): PlutusValidator {
    const typedBlueprint = blueprint as PlutusBlueprint;
    const validator = typedBlueprint.validators.find(
      (v) => v.title === 'inspection_policy.inspection_policy.mint',
    );
    if (!validator) {
      throw new InternalServerErrorException(
        'Validator "inspection_policy.inspection_policy.mint" not found in plutus.json.',
      );
    }
    return validator;
  }
}
