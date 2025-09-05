import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);
  constructor(private readonly prisma: PrismaService) {}

  private buildKey(userId: string, inspectionId: string) {
    return `${userId}:${inspectionId}`;
  }

  async hasConsumption(userId: string, inspectionId: string): Promise<boolean> {
    const uniqueKey = this.buildKey(userId, inspectionId);
    const existing = await this.prisma.creditConsumption.findUnique({ where: { uniqueKey } });
    return Boolean(existing);
  }

  /**
   * Atomically deduct 1 credit and write a consumption record.
   * Throws if not enough credits or uniqueKey conflict.
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
  }
}

