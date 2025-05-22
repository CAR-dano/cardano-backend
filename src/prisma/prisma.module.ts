/*
 * --------------------------------------------------------------------------
 * File: prisma.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for providing the PrismaService globally.
 * Imports ConfigModule for configuration access.
 * Exports PrismaService for use in other modules.
 * --------------------------------------------------------------------------
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config';

@Global() // Makes PrismaService available globally
@Module({
  imports: [ConfigModule], // PrismaService requires ConfigService
  providers: [PrismaService],
  exports: [PrismaService], // Exports PrismaService for injection in other modules
})
export class PrismaModule {}
