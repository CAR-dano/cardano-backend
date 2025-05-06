import { IsString, IsNotEmpty } from 'class-validator';

export class CreateInspectionBranchCityDto {
  @IsString()
  @IsNotEmpty()
  namaKota: string;
}
