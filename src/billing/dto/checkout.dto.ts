import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum BillingGateway {
  XENDIT = 'XENDIT',
}

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  packageId!: string;

  @IsEnum(BillingGateway)
  gateway!: BillingGateway;
}

