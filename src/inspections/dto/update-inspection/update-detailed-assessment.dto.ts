import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateTestDriveDto } from './update-test-drive.dto';
import { UpdateBanDanKakiKakiDto } from './update-ban-dan-kaki-kaki.dto';
import { UpdateHasilInspeksiEksteriorDto } from './update-hasil-inspeksi-eksterior.dto';
import { UpdateToolsTestDto } from './update-tools-test.dto';
import { UpdateFiturDto } from './update-fitur.dto';
import { UpdateHasilInspeksiMesinDto } from './update-hasil-inspeksi-mesin.dto';
import { UpdateHasilInspeksiInteriorDto } from './update-hasil-inspeksi-interior.dto';

export class UpdateDetailedAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTestDriveDto)
  testDrive?: UpdateTestDriveDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBanDanKakiKakiDto)
  banDanKakiKaki?: UpdateBanDanKakiKakiDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHasilInspeksiEksteriorDto)
  hasilInspeksiEksterior?: UpdateHasilInspeksiEksteriorDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateToolsTestDto)
  toolsTest?: UpdateToolsTestDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFiturDto)
  fitur?: UpdateFiturDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHasilInspeksiMesinDto)
  hasilInspeksiMesin?: UpdateHasilInspeksiMesinDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHasilInspeksiInteriorDto)
  hasilInspeksiInterior?: UpdateHasilInspeksiInteriorDto;
}
