/*
 * --------------------------------------------------------------------------
 * File: ipfs.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service for interacting with IPFS.
 * Handles connecting to an IPFS node and adding content.
 * --------------------------------------------------------------------------
 */

// NestJS common modules
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../logging/app-logger.service';
import { ConfigService } from '@nestjs/config';

// Third-party libraries
import { create, IPFSHTTPClient } from 'ipfs-http-client';

@Injectable()
export class IpfsService implements OnModuleInit {
  // Logger instance for logging messages
  // IPFS client instance
  private ipfs: IPFSHTTPClient;

  /**
   * Constructs the IpfsService.
   * @param configService Service for accessing configuration values.
   */
  constructor(private configService: ConfigService, private readonly logger: AppLogger) {
    this.logger.setContext(IpfsService.name);
  }

  /**
   * Initializes the module and connects to the IPFS node.
   * Retrieves the IPFS API URL from configuration.
   * Throws an error if the IPFS API URL is not found.
   */
  onModuleInit() {
    const host = this.configService.get<string>('IPFS_API_HOST');
    const port = this.configService.get<number>('IPFS_API_PORT');

    if (!host) {
      throw new Error('IPFS_API_HOST not found in configuration.');
    }
    if (!port) {
      throw new Error('IPFS_API_PORT not found in configuration.');
    }

    const apiUrl = `http://${host}:${port}`;

    this.ipfs = create({ url: apiUrl });

    this.logger.log(`Connecting to IPFS API at: ${apiUrl}`);
  }

  /**
   * Adds content to IPFS and returns its CID.
   *
   * @param content The buffer of the file to be uploaded.
   * @returns A promise that resolves to the CID of the uploaded file.
   * @throws Error if adding the file to IPFS fails.
   */
  async add(content: Buffer): Promise<string> {
    try {
      // Add content to IPFS
      const result = await this.ipfs.add(content);
      // Log successful file addition with CID
      this.logger.log(`File added with CID: ${result.path}`);
      // Return the CID
      return result.path;
    } catch (error) {
      // Log error if file addition fails
      this.logger.error('Failed to add file to IPFS', (error as Error)?.stack);
      // Re-throw the error
      throw error;
    }
  }
}
