import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CheckoutDto, BillingGateway } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { CheckoutResponseDto } from './dto/checkout-response.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @Get('packages')
  @ApiOperation({ summary: 'List active credit packages' })
  @ApiResponse({ status: 200, description: 'Packages list' })
  async listPackages() {
    const packagesList = await this.billing.listPackages();
    return { packages: packagesList };
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Create checkout (Xendit invoice) for a credit package' })
  @ApiBody({ type: CheckoutDto })
  @ApiCreatedResponse({ description: 'Checkout created; returns payment URL', type: CheckoutResponseDto })
  async checkout(
    @Body() dto: CheckoutDto,
    @GetUser('id') userId: string,
  ) {
    if (dto.gateway !== BillingGateway.XENDIT) {
      throw new Error('Only XENDIT gateway is supported');
    }
    const result = await this.billing.createCheckout(userId, dto.packageId);
    return result as CheckoutResponseDto;
  }

  @Post('webhook/xendit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xendit webhook handler (idempotent)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async xenditWebhook(
    @Body() body: any,
    @Headers('x-callback-token') callbackToken: string,
  ) {
    const expected = this.config.get<string>('XENDIT_CALLBACK_TOKEN');
    if (!expected || callbackToken !== expected) {
      // Intentionally reply 403 (but do not leak whether expected is set)
      return { ok: false };
    }
    // Handle various payload shapes
    const data = body?.data || body || {};
    const invoiceId = data.id || body?.id;
    const status = (data.status || body?.status || '').toUpperCase();
    if (!invoiceId) return { ok: true };

    if (status === 'PAID' || status === 'SETTLED') {
      await this.billing.markPaidByExtInvoiceId(invoiceId);
    }
    return { ok: true };
  }
}
