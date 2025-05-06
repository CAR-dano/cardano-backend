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
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PhotosModule } from './photos/photos.module';
import { InspectionBranchesModule } from './inspection-branches/inspection-branches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available across applications
      envFilePath: '.env', // Specifies the .env file
    }),
    // --- Konfigurasi ServeStaticModule ---
    ServeStaticModule.forRoot({
      // rootPath: Menentukan folder di filesystem server yang ingin disajikan.
      // join(process.cwd(), 'uploads'): Membuat path absolut ke folder 'uploads'
      // di root proyek Anda (tempat folder 'dist' biasanya berada setelah build).
      rootPath: join(process.cwd(), 'uploads'),

      // serveRoot: Menentukan prefix URL tempat file akan tersedia.
      // Jika serveRoot: '/uploads', maka file di './uploads/inspection-photos/image.jpg'
      // akan bisa diakses via URL: http://localhost:3000/uploads/inspection-photos/image.jpg
      // Jika serveRoot: '/static-files', URLnya akan jadi http://localhost:3000/static-files/inspection-photos/image.jpg
      // '/uploads' adalah pilihan yang umum dan intuitif.
      serveRoot: '/uploads',

      // Opsional: Exclude route API agar tidak tertimpa oleh static serving
      // exclude: ['/api/v1/(.*)'], // Hati-hati jika serveRoot juga '/api/v1'

      // Opsional: Konfigurasi tambahan (cache control, dll.)
      // serveStaticOptions: {
      //   maxAge: '1d', // Contoh cache 1 hari
      //   setHeaders: (res, path, stat) => {
      //     res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Penting jika FE di domain berbeda
      //   },
      // },
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
    PhotosModule,
    InspectionBranchesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
