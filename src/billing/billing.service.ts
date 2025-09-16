/*
 * --------------------------------------------------------------------------
 * File: billing.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service encapsulating billing operations including listing
 * packages, creating Xendit checkouts, and crediting users on payment.
 * --------------------------------------------------------------------------
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway, PurchaseStatus } from '@prisma/client';
import { XenditService } from './payments/xendit.service';
import { ConfigService } from '@nestjs/config';

/**
 * @class BillingService
 * @description Business logic for billing flows and integrations.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xendit: XenditService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    private readonly audit: AuditLoggerService,
  ) {
    this.logger.setContext(BillingService.name);
  }

  /**
   * Returns all active credit packages ordered by newest first.
   */
  async listPackages() {
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a pending purchase and corresponding Xendit invoice, then returns
   * identifiers and payment URL for the client.
   *
   * @param userId Buyer user ID
   * @param packageId Selected credit package ID
   * @returns Purchase and invoice identifiers with payment URL
   * @throws BadRequestException When package is unavailable
   */
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

  /**
   * Marks a purchase as PAID by external invoice ID and increments
   * the buyer's credit balance accordingly. Safe to call repeatedly.
   *
   * @param extInvoiceId External invoice ID from Xendit
   */
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
      this.audit.log({
        rid: 'n/a',
        actorId: p.userId,
        action: 'PURCHASE_PAID',
        resource: 'credit_purchase',
        subjectId: p.id,
        result: 'SUCCESS',
        meta: { extInvoiceId, credits: p.creditPackage.credits, amount: p.amount },
      });
    });
  }
}
