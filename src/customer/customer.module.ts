/*
 * --------------------------------------------------------------------------
 * File: customer.module.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: Module bundling customer-facing self-service features such as
 * purchased report history, report detail access, and no-docs downloads.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { CustomerReportsController } from './customer-reports.controller';
import { CustomerReportsService } from './customer-reports.service';
import { ReportsModule } from '../reports/reports.module';
import { CreditsModule } from '../credits/credits.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerVehiclesController } from './customer-vehicles.controller';
import { CustomerVehiclesService } from './customer-vehicles.service';

@Module({
  imports: [PrismaModule, ReportsModule, CreditsModule],
  controllers: [CustomerReportsController, CustomerVehiclesController],
  providers: [CustomerReportsService, CustomerVehiclesService],
})
export class CustomerModule {}
