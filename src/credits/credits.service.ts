/*
 * --------------------------------------------------------------------------
 * File: credits.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service managing user credit consumption for paid features
 * such as downloading no-docs PDF reports. Provides idempotent checks and
 * atomic charge operation using database transactions.
 * --------------------------------------------------------------------------
 */

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * @class CreditsService
 * @description Business logic for checking and consuming credits.
 */
@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService, private readonly logger: AppLogger, private readonly audit: AuditLoggerService) {
    this.logger.setContext(CreditsService.name);
  }

  /**
   * Builds unique consumption key to ensure idempotency per user+inspection.
   */
  private buildKey(userId: string, inspectionId: string) {
    return `${userId}:${inspectionId}`;
  }

  /**
   * Checks whether a user has already been charged for a specific inspection.
   *
   * @param userId User identifier
   * @param inspectionId Inspection identifier
   * @returns True if a consumption record exists
   */
  async hasConsumption(userId: string, inspectionId: string): Promise<boolean> {
    const uniqueKey = this.buildKey(userId, inspectionId);
    const existing = await this.prisma.creditConsumption.findUnique({ where: { uniqueKey } });
    return Boolean(existing);
  }

  /**
   * Atomically deduct 1 credit and write a consumption record.
   * Throws if not enough credits or uniqueKey conflict.
   *
   * @param userId User identifier
   * @param inspectionId Inspection identifier
   * @param cost Number of credits to deduct (default 1)
   * @throws BadRequestException if user not found
   * @throws ForbiddenException if insufficient credits
   */
  async chargeOnce(userId: string, inspectionId: string, cost = 1): Promise<void> {
    const uniqueKey = this.buildKey(userId, inspectionId);
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
      if (!user) throw new BadRequestException('User not found');
      if ((user.credits ?? 0) < cost) throw new ForbiddenException('INSUFFICIENT_CREDITS');

      await tx.user.update({ where: { id: userId }, data: { credits: { decrement: cost } } });
      await tx.creditConsumption.create({
        data: { userId, inspectionId, cost, uniqueKey },
      });
    });
    this.logger.log(`Charged ${cost} credit(s) for user=${userId} inspection=${inspectionId}`);
    this.audit.log({
      rid: 'n/a',
      actorId: userId,
      action: 'CREDITS_CHARGED',
      resource: 'credit',
      subjectId: inspectionId,
      result: 'SUCCESS',
      meta: { cost },
    });
  }
}
