import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // Import ConfigModule if PdfService needs ConfigService
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
