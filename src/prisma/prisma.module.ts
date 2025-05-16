/*
 * --------------------------------------------------------------------------
 * File: prisma.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module responsible for providing the PrismaService globally.
 * Imports the ConfigModule as PrismaService requires ConfigService.
 * Exports the PrismaService to be injected into other modules.
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
