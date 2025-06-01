import { Module } from '@nestjs/common';
import { CsvExportService } from './csv-export.service';
import { PrismaModule } from '../prisma/prisma.module'; // Assuming PrismaService is exported

@Module({
  imports: [PrismaModule], // Import PrismaModule if CsvExportService needs PrismaService
  providers: [CsvExportService],
  exports: [CsvExportService],
})
export class CsvExportModule {}
