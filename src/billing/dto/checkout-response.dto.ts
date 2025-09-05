import { ApiProperty } from '@nestjs/swagger';

export class CheckoutResponseDto {
  @ApiProperty({ description: 'Internal purchase ID' })
  purchaseId!: string;

  @ApiProperty({ description: 'Xendit invoice id' })
  extInvoiceId!: string;

  @ApiProperty({ description: 'Redirect URL to pay invoice' })
  paymentUrl!: string;
}

