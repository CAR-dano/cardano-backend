import { ApiProperty } from '@nestjs/swagger';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { TestDriveDto } from './test-drive.dto';
import { BanDanKakiKakiDto } from './ban-dan-kaki-kaki.dto';
import { HasilInspeksiEksteriorDto } from './hasil-inspeksi-eksterior.dto';
import { ToolsTestDto } from './tools-test.dto';
import { FiturDto } from './fitur.dto';
import { HasilInspeksiMesinDto } from './hasil-inspeksi-mesin.dto';
import { HasilInspeksiInteriorDto } from './hasil-inspeksi-interior.dto';

export class DetailedAssessmentDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => TestDriveDto)
  @IsNotEmpty()
  testDrive: TestDriveDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BanDanKakiKakiDto)
  @IsNotEmpty()
  banDanKakiKaki: BanDanKakiKakiDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => HasilInspeksiEksteriorDto)
  @IsNotEmpty()
  hasilInspeksiEksterior: HasilInspeksiEksteriorDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => ToolsTestDto)
  @IsNotEmpty()
  toolsTest: ToolsTestDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => FiturDto)
  @IsNotEmpty()
  fitur: FiturDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => HasilInspeksiMesinDto)
  @IsNotEmpty()
  hasilInspeksiMesin: HasilInspeksiMesinDto;

  @ApiProperty()
  @ValidateNested()
  @Type(() => HasilInspeksiInteriorDto)
  @IsNotEmpty()
  hasilInspeksiInterior: HasilInspeksiInteriorDto;
}
