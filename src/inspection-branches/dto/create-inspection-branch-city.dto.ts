import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInspectionBranchCityDto {
  @ApiProperty({ example: 'Jakarta', description: 'Name of the city' })
  @IsString()
  @IsNotEmpty()
  city: string;
}
