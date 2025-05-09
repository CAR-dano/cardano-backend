import { Module } from '@nestjs/common';
import { InspectionChangeLogService } from './inspection-change-log.service';
import { InspectionChangeLogController } from './inspection-change-log.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InspectionChangeLogController],
  providers: [InspectionChangeLogService],
  exports: [InspectionChangeLogService], // Export if needed by other modules
})
export class InspectionChangeLogModule {}
