/*
 * --------------------------------------------------------------------------
 * File: prisma.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Prisma service for database interaction in NestJS.
 * Extends PrismaClient and implements OnModuleInit and OnModuleDestroy
 * lifecycle hooks for connecting and disconnecting from the database.
 * Uses ConfigService to get the database URL.
 * Includes an optional method for cleaning the database in non-production environments.
 * --------------------------------------------------------------------------
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Constructs the PrismaService.
   * Initializes the PrismaClient with the database URL from ConfigService.
   * @param config The ConfigService instance.
   */
  constructor(config: ConfigService) {
    const dbUrl = config.get<string>('DATABASE_URL');
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set.');
    }
    super({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });
  }

  /**
   * Connects to the database when the module is initialized.
   */
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('Prisma Client connected');
    } catch (error) {
      console.error('Error connecting Prisma Client', error);
    }
  }

  /**
   * Closes the database connection when the application is shut down.
   */
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Prisma Client disconnected.');
  }

  /**
   * Cleans the database.
   * This function is intended for testing environments and will not run in production.
   * It uses a Prisma transaction to remove data sequentially based on foreign key constraints.
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return;

    // Prisma transaction to remove data sequentially (if there is a relation)
    // Adjust the order based on foreign key constraints
    return this.$transaction([
      // this.inspection.deleteMany(), // Clear inspection first if there is a relation to the user
      this.user.deleteMany(), // Delete user
      // ... remove other models
    ]);
  }
}
