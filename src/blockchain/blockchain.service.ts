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
  pdfUrl: string;
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

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private readonly blockfrostProvider: BlockfrostProvider;
  private readonly wallet: MeshWallet; // Use AppWallet type for better type safety
  private readonly apiKey: string;
  private readonly blockfrostBaseUrl: string;

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
    let secretKey: string | undefined;
    switch (blockfrostEnv) {
      case 'preview':
      case 'preprod':
        secretKey = this.configService.get<string>('WALLET_SECRET_KEY_TESTNET');
        break;
      case 'mainnet':
        secretKey = this.configService.get<string>('WALLET_SECRET_KEY_mainnet');
        break;
      default:
        throw new Error(
          `Unsupported BLOCKFROST_ENV for wallet: ${blockfrostEnv as string}`,
        );
    }

    if (!secretKey) {
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
        bech32: secretKey,
      },
      // Parameters can be added here if needed globally
    });
    this.logger.log('MeshWallet Initialized.');
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

    try {
      const utxos = await this.wallet.getUtxos();
      if (!utxos || utxos.length === 0) {
        throw new InternalServerErrorException(
          'Wallet has no UTXOs available to build the transaction.',
        );
      }
      this.logger.debug(`Found ${utxos.length} UTXOs for wallet.`);

      // Get the primary address of the wallet to use for forging script and change address
      const walletAddress = (await this.wallet.getUsedAddresses())[0]; // Use getChangeAddress for consistency

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
        .selectUtxosFrom(utxos) // Provide the UTXOs to use for inputs/fees
        .complete(); // Calculate fees and build the transaction body

      this.logger.log('Transaction built successfully. Signing...');

      // Sign the transaction
      const signedTx = await this.wallet.signTx(unsignedTx, true); // Partial sign might be false if wallet holds all keys
      this.logger.log('Transaction signed successfully. Submitting...');

      // Submit the transaction
      const txHash = await this.wallet.submitTx(signedTx);
      this.logger.log(`Transaction submitted successfully. TxHash: ${txHash}`);

      return { txHash, assetId };
    } catch (error: any) {
      this.logger.error('NFT Minting failed:', error);
      // Provide more context if possible
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const errorMessage = error
        ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.info || // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          error.message ||
          'Unknown error during minting'
        : 'Unknown error during minting';
      throw new InternalServerErrorException(
        `Failed to mint NFT: ${errorMessage}`,
      );
    }
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
              hash_pdf: inspectionData.pdfHash,
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
