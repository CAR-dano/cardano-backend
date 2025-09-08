import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { XenditService } from './payments/xendit.service';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, XenditService],
})
export class BillingModule {}

