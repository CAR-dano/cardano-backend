/*
 * --------------------------------------------------------------------------
 * File: app.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: The root module of the NestJS application.
 * Configures and imports all necessary modules for the application to function,
 * including authentication, blockchain interaction, external authentication,
 * inspections, public API endpoints, documentation, user management,
 * database access, static file serving, photos, inspection branches,
 * and inspection change logs.
 * --------------------------------------------------------------------------
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { ExternalAuthModule } from './external-auth/external-auth.module';
import { InspectionsModule } from './inspections/inspections.module';
import { PublicApiModule } from './public-api/public-api.module';
import { ScalarDocsModule } from './scalar-docs/scalar-docs.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PhotosModule } from './photos/photos.module';
import { InspectionBranchesModule } from './inspection-branches/inspection-branches.module';
import { InspectionChangeLogModule } from './inspection-change-log/inspection-change-log.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { CommonModule } from './common/common.module';
import { ReportsModule } from './reports/reports.module';
import { CreditsModule } from './credits/credits.module';
import { BillingModule } from './billing/billing.module';
import { CreditPackagesModule } from './credit-packages/credit-packages.module';
import { AppLoggingModule } from './logging/logging.module';
import { CustomerModule } from './customer/customer.module';
import { RequestIdMiddleware } from './logging/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available across applications
      envFilePath: '.env', // Specifies the .env file
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 200,
      },
    ]),
    // Note: Static serving for 'uploads' is disabled to force all access via API controllers
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      // Avoid conflicting with API routes: serve public assets under /public
      serveRoot: '/public',
    }),
    AuthModule,
    BlockchainModule,
    ExternalAuthModule,
    InspectionsModule,
    InspectionChangeLogModule,
    PublicApiModule,
    ScalarDocsModule,
    UsersModule,
    PrismaModule,
    PhotosModule,
    InspectionBranchesModule,
    DashboardModule,
    IpfsModule,
    MetricsModule,
    CommonModule,
    ReportsModule,
    CreditsModule,
    BillingModule,
    CreditPackagesModule,
    AppLoggingModule,
    CustomerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, MetricsMiddleware).forRoutes('*');
  }
}
