import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionStatus } from '@prisma/client';
import { PhotoResponseDto } from '../../photos/dto/photo-response.dto';

export class ReportDetailInspectionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  pretty_id!: string;

  @ApiPropertyOptional({ nullable: true })
  vehiclePlateNumber?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    description: 'Vehicle data JSON',
    additionalProperties: true,
  })
  vehicleData?: any | null;

  @ApiProperty({ enum: Object.values(InspectionStatus) })
  status!: InspectionStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Legacy/public path to no-docs PDF' })
  urlPdfNoDocs?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Cloud URL to no-docs PDF (Backblaze)' })
  urlPdfNoDocsCloud?: string | null;

  @ApiPropertyOptional({
    description:
      'Subset of photos for key exterior views (Front, Right Side, Left Side, Rear).',
    type: PhotoResponseDto,
    isArray: true,
  })
  photos?: PhotoResponseDto[];
}

export class ReportDetailResponseDto {
  @ApiProperty({ type: ReportDetailInspectionDto })
  inspection!: ReportDetailInspectionDto;

  @ApiProperty({ description: 'Whether current user can download now' })
  canDownload!: boolean;

  @ApiPropertyOptional({ description: 'Customer credit balance (only for CUSTOMER)', nullable: true })
  userCreditBalance?: number;
}
