/*
 * --------------------------------------------------------------------------
 * File: ipfs.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for managing IPFS interactions.
 * Imports the IpfsService to provide IPFS functionality.
 * Exports the IpfsService for use in other modules.
 * --------------------------------------------------------------------------
 */

// NestJS common modules
import { Module } from '@nestjs/common';

// Local services
import { IpfsService } from './ipfs.service';

@Module({
  providers: [IpfsService],
  exports: [IpfsService],
})
export class IpfsModule {}
