import { PartialType } from '@nestjs/mapped-types';
import { CreateInspectionBranchCityDto } from './create-inspection-branch-city.dto';

export class UpdateInspectionBranchCityDto extends PartialType(
  CreateInspectionBranchCityDto,
) {}
