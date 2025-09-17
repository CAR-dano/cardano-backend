/*
 * --------------------------------------------------------------------------
 * File: webhook-events.service.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: Service providing persistent, DB-backed idempotency and
 * audit storage for payment gateway webhooks (Xendit, etc.).
 * --------------------------------------------------------------------------
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../logging/app-logger.service';
import { Prisma } from '@prisma/client';

interface RecordInput {
  dedupeKey: string;
  gateway: string;
  extInvoiceId: string;
  eventType?: string | null;
  payload?: any;
  headers?: any;
  payloadHash?: string | null;
}

@Injectable()
export class WebhookEventsService {
  constructor(private readonly prisma: PrismaService, private readonly logger: AppLogger) {
    this.logger.setContext(WebhookEventsService.name);
  }

  async recordNewOrDuplicate(input: RecordInput): Promise<{ isDuplicate: boolean; id?: string }>
  {
    try {
      const created = await (this.prisma as any).webhookEvent.create({
        data: {
          dedupeKey: input.dedupeKey,
          gateway: input.gateway,
          extInvoiceId: input.extInvoiceId,
          eventType: input.eventType || null,
          payload: input.payload ?? undefined,
          headers: input.headers ?? undefined,
          payloadHash: input.payloadHash || null,
          attempts: 1,
        },
      });
      this.logger.log(`WebhookEvent created: ${input.dedupeKey}`);
      return { isDuplicate: false, id: created.id as string };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Duplicate webhook event ignored: ${input.dedupeKey}`);
        return { isDuplicate: true };
      }
      this.logger.error(`recordNewOrDuplicate failed: ${String(err?.message ?? err)}`);
      throw err;
    }
  }

  async markProcessed(id: string, result: 'SUCCESS' | 'IGNORED' = 'SUCCESS') {
    await (this.prisma as any).webhookEvent.update({
      where: { id },
      data: { processedAt: new Date(), result },
    });
  }

  async markError(id: string, error: string) {
    await (this.prisma as any).webhookEvent.update({
      where: { id },
      data: { result: 'ERROR', error },
    });
  }
}

