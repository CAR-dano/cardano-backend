import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { create, IPFSHTTPClient } from 'ipfs-http-client';

@Injectable()
export class IpfsService implements OnModuleInit {
  private readonly logger = new Logger(IpfsService.name);
  private ipfs: IPFSHTTPClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const ipfsApiUrl = this.configService.get<string>('IPFS_API_URL');
    if (!ipfsApiUrl) {
      throw new Error('IPFS_API_URL not found in configuration.');
    }
    this.ipfs = create({ url: ipfsApiUrl });
    this.logger.log(`Connected to IPFS node in: ${ipfsApiUrl}`);
  }

  /**
   * Menambahkan konten ke IPFS dan me-return CID-nya.
   * @param content Buffer dari file yang akan di-upload.
   * @returns {Promise<string>} CID dari file yang di-upload.
   */
  async add(content: Buffer): Promise<string> {
    try {
      const result = await this.ipfs.add(content);
      this.logger.log(`File has been added with CID: ${result.path}`);
      return result.path;
    } catch (error) {
      this.logger.error('Failed add file to IPFS', error);
      throw error;
    }
  }
}
