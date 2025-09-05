import { ApiProperty } from '@nestjs/swagger';
import { CreditPackageResponseDto } from './credit-package-response.dto';

export class CreditPackageListResponseDto {
  @ApiProperty({ type: CreditPackageResponseDto, isArray: true })
  packages!: CreditPackageResponseDto[];

  constructor(items: CreditPackageResponseDto[]) {
    this.packages = items;
  }
}

