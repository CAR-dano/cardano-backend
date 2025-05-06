import { Module } from '@nestjs/common';
import { InspectionBranchesController } from './inspection-branches.controller';
import { InspectionBranchesService } from './inspection-branches.service';

@Module({
  controllers: [InspectionBranchesController],
  providers: [InspectionBranchesService]
})
export class InspectionBranchesModule {}
