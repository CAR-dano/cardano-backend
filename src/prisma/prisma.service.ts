/*
 * --------------------------------------------------------------------------
 * File: prisma.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Provides the Prisma database client as a NestJS injectable service.
 * Handles database connection initialization and disconnection.
 * Includes an optional method for cleaning the database during testing.
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
   * Initializes the PrismaClient with the database URL from the ConfigService.
   *
   * @param config The ConfigService instance.
   * @throws Error if DATABASE_URL environment variable is not set.
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
   * Disconnects from the database when the application is shut down.
   */
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Prisma Client disconnected.');
  }

  /**
   * Cleans the database.
   * This method is intended for testing environments and will not run in production.
   * It performs a transaction to remove data sequentially based on foreign key constraints.
   *
   * @returns A promise that resolves when the database cleaning is complete.
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
