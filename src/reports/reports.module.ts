import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CreditsModule, CommonModule],
  controllers: [ReportsController],
})
export class ReportsModule {}

