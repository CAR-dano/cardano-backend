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
  @ApiPropertyOptional({ type: () => UpdateTestDriveDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTestDriveDto)
  testDrive?: UpdateTestDriveDto;

  @ApiPropertyOptional({ type: () => UpdateBanDanKakiKakiDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBanDanKakiKakiDto)
  banDanKakiKaki?: UpdateBanDanKakiKakiDto;

  @ApiPropertyOptional({ type: () => UpdateHasilInspeksiEksteriorDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHasilInspeksiEksteriorDto)
  hasilInspeksiEksterior?: UpdateHasilInspeksiEksteriorDto;

  @ApiPropertyOptional({ type: () => UpdateToolsTestDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateToolsTestDto)
  toolsTest?: UpdateToolsTestDto;

  @ApiPropertyOptional({ type: () => UpdateFiturDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFiturDto)
  fitur?: UpdateFiturDto;

  @ApiPropertyOptional({ type: () => UpdateHasilInspeksiMesinDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHasilInspeksiMesinDto)
  hasilInspeksiMesin?: UpdateHasilInspeksiMesinDto;

  @ApiPropertyOptional({ type: () => UpdateHasilInspeksiInteriorDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHasilInspeksiInteriorDto)
  hasilInspeksiInterior?: UpdateHasilInspeksiInteriorDto;
}
