/*
 * --------------------------------------------------------------------------
 * File: secrets.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Global NestJS module that provides VaultConfigService
 * to the entire application. Import once in AppModule — all other modules
 * receive VaultConfigService via dependency injection automatically
 * because this module is marked as global.
 * --------------------------------------------------------------------------
 */

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultConfigService } from './vault-config.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [VaultConfigService],
  exports: [VaultConfigService],
})
export class SecretsModule {}
