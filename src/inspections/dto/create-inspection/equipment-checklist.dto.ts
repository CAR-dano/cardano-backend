import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class EquipmentChecklistDto {
  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  bukuService: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  kunciSerep: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  bukuManual: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  banSerep: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  bpkb: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  dongkrak: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  toolkit: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  noRangka: boolean;

  @ApiProperty()
  @IsBoolean()
  @IsNotEmpty()
  noMesin: boolean;
}
