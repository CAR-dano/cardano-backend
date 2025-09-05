import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class CreateCreditPackageDto {
  @ApiProperty({ description: 'Number of credits', example: 100 })
  @IsInt()
  @Min(1)
  credits!: number;

  @ApiProperty({ description: 'Net price (rupiah)', example: 150000 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ description: 'Discount percentage (0..100)', example: 10 })
  @IsInt()
  @Min(0)
  @Max(100)
  discountPct!: number;

  @ApiPropertyOptional({ description: 'Arbitrary benefits JSON', example: { note: 'promo sept' } })
  @IsOptional()
  @IsObject()
  benefits?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'Whether the package is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

