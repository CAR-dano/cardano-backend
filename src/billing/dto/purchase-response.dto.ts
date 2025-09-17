/*
 * --------------------------------------------------------------------------
 * File: dto/purchase-response.dto.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: DTOs for returning purchase information (detail and list)
 * including nested credit package info for Swagger docs and clients.
 * --------------------------------------------------------------------------
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentGateway, PurchaseStatus } from '@prisma/client';
import { CreditPackageResponseDto } from '../../credit-packages/dto/credit-package-response.dto';

export class PurchaseResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  packageId!: string;

  @ApiProperty({ enum: Object.values(PaymentGateway) })
  gateway!: PaymentGateway;

  @ApiProperty()
  extInvoiceId!: string;

  @ApiProperty({
    description: 'Amount in smallest currency unit (e.g., rupiah)',
  })
  amount!: number;

  @ApiProperty({ enum: Object.values(PurchaseStatus) })
  status!: PurchaseStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  paidAt?: Date | null;

  @ApiPropertyOptional({ type: () => CreditPackageResponseDto })
  creditPackage?: CreditPackageResponseDto;

  constructor(p: any) {
    this.id = p.id;
    this.userId = p.userId;
    this.packageId = p.packageId;
    this.gateway = p.gateway;
    this.extInvoiceId = p.extInvoiceId;
    this.amount = p.amount;
    this.status = p.status;
    this.createdAt = p.createdAt;
    this.paidAt = p.paidAt ?? null;
    if (p.creditPackage)
      this.creditPackage = new CreditPackageResponseDto(p.creditPackage);
  }
}

export class PurchaseItemResponseDto {
  @ApiProperty({ type: () => PurchaseResponseDto })
  purchase!: PurchaseResponseDto;

  constructor(p: any) {
    this.purchase = new PurchaseResponseDto(p);
  }
}

export class PurchaseListResponseDto {
  @ApiProperty({ type: () => PurchaseResponseDto, isArray: true })
  purchases!: PurchaseResponseDto[];

  constructor(list: any[]) {
    this.purchases = list.map((p) => new PurchaseResponseDto(p));
  }
}
