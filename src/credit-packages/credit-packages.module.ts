import { Module } from '@nestjs/common';
import { CreditPackagesController } from './credit-packages.controller';
import { CreditPackagesService } from './credit-packages.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CreditPackagesController],
  providers: [CreditPackagesService],
})
export class CreditPackagesModule {}
