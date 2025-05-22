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
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlockfrostProvider,
  MeshTxBuilder,
  MeshWallet,
  ForgeScript,
  resolveScriptHash,
  stringToHex,
} from '@meshsdk/core';
import { createHash } from 'crypto'; // For generating token name hash
import { TransactionMetadataResponseDto } from './dto/transaction-metadata-response.dto';
import { NftDataResponseDto } from './dto/nft-data-response.dto';

/**
 * Defines the structure for inspection NFT metadata, aligning with desired on-chain data.
 */
interface InspectionNftMetadata {
  inspectionId: string;
  inspectionDate: string;
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  overallRating: string;
  pdfUrl: string;
  pdfHash: string;
  inspectorId: string;
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
    const blockfrostEnv =
      this.configService.getOrThrow<string>('BLOCKFROST_ENV');
    switch (blockfrostEnv) {
      case 'preprod':
        this.blockfrostBaseUrl = 'https://cardano-preprod.blockfrost.io/api/v0';
        break;
      case 'preview':
        this.blockfrostBaseUrl = 'https://cardano-preview.blockfrost.io/api/v0';
        break;
      case 'mainnet':
        this.blockfrostBaseUrl = 'https://cardano-mainnet.blockfrost.io/api/v0';
        break;
      default:
        throw new Error(`Unsupported BLOCKFROST_ENV: ${blockfrostEnv}`);
    }
    this.logger.log(`Using Blockfrost environment: ${blockfrostEnv}`);

    // Initialize Blockfrost Provider
    switch (blockfrostEnv) {
      case 'preview':
        this.apiKey = this.configService.getOrThrow<string>(
          'BLOCKFROST_API_KEY_PREVIEW',
        );
        break;
      case 'preprod':
        this.apiKey = this.configService.getOrThrow<string>(
          'BLOCKFROST_API_KEY_PREPROD',
        );
        break;
      case 'mainnet':
        this.apiKey = this.configService.getOrThrow<string>(
          'BLOCKFROST_API_KEY_MAINNET',
        );
        break;
      default:
        throw new Error(
          `Unsupported BLOCKFROST_ENV: ${blockfrostEnv as string}`,
        );
    }
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
        secretKey = this.configService.get<string>('WALLET_SECRET_KEY_MAINNET');
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
      networkId: blockfrostEnv === 'mainnet' ? 1 : 0, // 0 for Preprod/Preview, 1 for Mainnet
      fetcher: this.blockfrostProvider,
      submitter: this.blockfrostProvider,
      key: {
        type: 'root', // Assuming root key from bech32 string
        bech32: secretKey,
      },
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
   * Generates a unique token name based on input data using SHA256 hash.
   *
   * @param dataToHash A string uniquely identifying the data to hash.
   * @returns A hexadecimal string representing the token name (32 bytes / 64 hex chars).
   */
  private generateTokenName(dataToHash: string): string {
    const hash = createHash('sha256');
    hash.update(dataToHash);
    const digest = hash.digest('hex');
    this.logger.debug(
      `Generated SHA256 digest (Token Name Hex): ${digest} (Length: ${digest.length})`,
    ); // Should be 64
    // No need to substring if already 64 char hex (32 byte)
    return digest;
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
      const finalMetadata = { ...metadata, name: nftDisplayName }; // Add/overwrite name
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
}
