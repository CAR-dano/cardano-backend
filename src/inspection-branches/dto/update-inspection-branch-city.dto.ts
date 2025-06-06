/*
 * --------------------------------------------------------------------------
 * File: update-inspection-branch-city.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for updating an existing
 * inspection branch city. Inherits properties from CreateInspectionBranchCityDto
 * and makes them optional using PartialType.
 * --------------------------------------------------------------------------
 */

import { PartialType } from '@nestjs/mapped-types';
import { CreateInspectionBranchCityDto } from './create-inspection-branch-city.dto';

/**
 * Data Transfer Object for updating an existing inspection branch city.
 * All fields are optional as it extends PartialType of CreateInspectionBranchCityDto.
 */
export class UpdateInspectionBranchCityDto extends PartialType(
  CreateInspectionBranchCityDto,
) {}
