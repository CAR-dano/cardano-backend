import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
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

  async onModuleInit() {
    // Connects to the database when the module is initialized
    try {
      await this.$connect();
      console.log('Prisma Client connected');
    } catch (error) {
      console.error('Error connecting Prisma Client', error);
    }
  }

  async onModuleDestroy() {
    // Close the connection when the app is shut down
    await this.$disconnect();
    console.log('Prisma Client disconnected.');
  }

  // (Optional) Clean database functions for testing
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') return; // Don't run in production

    // Prisma transaction to remove data sequentially (if there is a relation)
    // Adjust the order based on foreign key constraints
    return this.$transaction([
      // this.inspection.deleteMany(), // Clear inspection first if there is a relation to the user
      this.user.deleteMany(), // Delete user
      // ... remove other models
    ]);
  }
}
