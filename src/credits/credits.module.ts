import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsService } from './credits.service';

@Module({
  imports: [PrismaModule],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}

