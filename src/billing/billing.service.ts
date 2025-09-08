import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway, PurchaseStatus } from '@prisma/client';
import { XenditService } from './payments/xendit.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly xendit: XenditService,
    private readonly config: ConfigService,
  ) {}

  async listPackages() {
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCheckout(userId: string, packageId: string) {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw new BadRequestException('Package not available');

    // Create Purchase pending
    const purchase = await this.prisma.purchase.create({
      data: {
        userId,
        packageId,
        gateway: PaymentGateway.XENDIT,
        extInvoiceId: `temp_${Date.now()}`,
        amount: pkg.price,
        status: PurchaseStatus.PENDING,
      },
    });

    // Build Xendit invoice
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    const successUrl = this.config.get<string>('PAYMENT_RETURN_URL') || '';
    const webhookUrl = this.config.get<string>('PAYMENT_WEBHOOK_URL') || '';
    const callbackToken = this.config.get<string>('XENDIT_CALLBACK_TOKEN') || undefined;
    const inv = await this.xendit.createInvoice({
      external_id: purchase.id,
      amount: pkg.price,
      payer_email: user?.email || undefined,
      description: `Credit package ${pkg.credits} credits`,
      success_redirect_url: successUrl || undefined,
      failure_redirect_url: successUrl || undefined,
      callback_url: webhookUrl || undefined,
      callback_authentication_token: callbackToken,
    });

    await this.prisma.purchase.update({
      where: { id: purchase.id },
      data: { extInvoiceId: inv.id },
    });

    return { purchaseId: purchase.id, extInvoiceId: inv.id, paymentUrl: inv.invoice_url };
  }

  async markPaidByExtInvoiceId(extInvoiceId: string) {
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.purchase.findUnique({
        where: { extInvoiceId },
        include: { creditPackage: true },
      });
      if (!p) throw new BadRequestException('Purchase not found');
      if (p.status === PurchaseStatus.PAID) {
        this.logger.log(`Purchase already PAID extInvoiceId=${extInvoiceId}`);
        return; // idempotent
      }
      await tx.purchase.update({
        where: { id: p.id },
        data: { status: PurchaseStatus.PAID, paidAt: new Date() },
      });
      await tx.user.update({
        where: { id: p.userId },
        data: { credits: { increment: p.creditPackage.credits } },
      });
    });
  }
}

