/**
 * @fileoverview Module definition for inspection-related features.
 * Imports PrismaModule for database access, declares InspectionsController,
 * provides InspectionsService, and potentially MulterModule if needed globally (optional).
 */

import { Module } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';
import { PrismaModule } from '../prisma/prisma.module';
// import { MulterModule } from '@nestjs/platform-express'; // Opsional: bisa didaftarkan di sini jika perlu global config

@Module({
  imports: [
    PrismaModule, // Agar InspectionsService bisa inject PrismaService
    // MulterModule.register({ dest: './uploads' }), // Contoh pendaftaran global jika perlu
  ],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  // exports: [InspectionsService] // Export jika service ini akan dipakai modul lain
})
export class InspectionsModule {}
