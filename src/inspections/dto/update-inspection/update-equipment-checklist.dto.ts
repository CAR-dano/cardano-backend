import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEquipmentChecklistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bukuService?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kunciSerep?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bukuManual?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  banSerep?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bpkb?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dongkrak?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  toolkit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noRangka?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  noMesin?: boolean;
}
