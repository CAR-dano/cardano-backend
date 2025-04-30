import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { DatabaseModule } from './database/database.module';
import { ExternalAuthModule } from './external-auth/external-auth.module';
import { InspectionsModule } from './inspections/inspections.module';
import { PublicApiModule } from './public-api/public-api.module';
import { ReportsModule } from './reports/reports.module';
import { ScalarDocsModule } from './scalar-docs/scalar-docs.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available across applications
      envFilePath: '.env', // Specifies the .env file
    }),
    AuthModule,
    BlockchainModule,
    DatabaseModule,
    ExternalAuthModule,
    InspectionsModule,
    PublicApiModule,
    ReportsModule,
    ScalarDocsModule,
    UsersModule,
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}