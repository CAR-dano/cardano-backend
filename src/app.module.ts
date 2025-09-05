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
    // --- ServeStaticModule Configuration ---
    ServeStaticModule.forRoot({
      // rootPath: Specifies the folder in the server's filesystem to be served.
      // join(process.cwd(), 'uploads'): Creates an absolute path to the 'uploads' folder
      // at the project root (where the 'dist' folder is usually located after build).
      rootPath: join(process.cwd(), 'uploads'),

      // serveRoot: Specifies the URL prefix where files will be available.
      // If serveRoot: '/uploads', files in './uploads/inspection-photos/image.jpg'
      // will be accessible via URL: http://localhost:3000/uploads/inspection-photos/image.jpg
      // If serveRoot: '/static-files', the URL will be http://localhost:3000/static-files/inspection-photos/image.jpg
      // '/uploads' is a common and intuitive choice.
      serveRoot: '/uploads',

      // Optional: Exclude API routes so they are not overridden by static serving
      // exclude: ['/api/v1/(.*)'], // Be careful if serveRoot is also '/api/v1'

      // Optional: Additional configurations (cache control, etc.)
      // serveStaticOptions: {
      //   maxAge: '1d', // Example cache 1 day
      //   setHeaders: (res, path, stat) => {
      //     res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Important if FE is on a different domain
      //   },
      // },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/api/v1', // Serve public files under the /api/v1 prefix
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
