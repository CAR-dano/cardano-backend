import { Module } from '@nestjs/common';
import { SequenceService } from './sequence.service';
import { PrismaModule } from '../prisma/prisma.module'; // Assuming PrismaService is exported from PrismaModule

@Module({
  imports: [PrismaModule], // Import PrismaModule if SequenceService needs PrismaService
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
