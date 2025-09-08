import { ApiProperty } from '@nestjs/swagger';
import { CreditPackageResponseDto } from './credit-package-response.dto';

export class CreditPackageItemResponseDto {
  @ApiProperty({ type: CreditPackageResponseDto })
  package!: CreditPackageResponseDto;

  constructor(item: CreditPackageResponseDto) {
    this.package = item;
  }
}

