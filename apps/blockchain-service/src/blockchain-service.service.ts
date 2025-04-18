import { Injectable } from '@nestjs/common';

@Injectable()
export class BlockchainServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
