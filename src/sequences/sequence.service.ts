import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { format } from 'date-fns';

@Injectable()
export class SequenceService {
  private readonly logger = new Logger(SequenceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generates the next custom inspection ID based on branch code and date.
   * Format: BRANCHCODE-DDMMYYYY-SEQ (e.g., YOG-01052025-001)
   * IMPORTANT: This method MUST be called within a Prisma transaction to ensure atomicity
   * and prevent race conditions when generating sequence numbers.
   *
   * @param branchCode - 'YOG', 'SOL', 'SEM', etc.
   * @param inspectionDate - The date of the inspection.
   * @param tx - The Prisma transaction client.
   * @returns The next sequential ID string.
   * @throws {ConflictException} If a unique ID cannot be generated (e.g., due to unforeseen race conditions not handled by upsert logic).
   * @throws {InternalServerErrorException} For other unexpected errors.
   */
  public async generateNextInspectionId(
    branchCode: string,
    inspectionDate: Date,
    tx: Prisma.TransactionClient, // Requires Prisma transaction client
  ): Promise<string> {
    this.logger.log(
      `Generating next inspection ID for branch: ${branchCode}, date: ${inspectionDate}`,
    );
    const datePrefix = format(inspectionDate, 'ddMMyyyy');
    const idPrefix = `${branchCode.toUpperCase()}-${datePrefix}-`;

    try {
      const sequenceRecord = await tx.inspectionSequence.upsert({
        where: {
          branchCode_datePrefix: {
            branchCode: branchCode.toUpperCase(),
            datePrefix: datePrefix,
          },
        },
        update: {
          nextSequence: {
            increment: 1,
          },
        },
        create: {
          branchCode: branchCode.toUpperCase(),
          datePrefix: datePrefix,
          nextSequence: 1, // Start at 1 for a new sequence, upsert handles increment if it exists
        },
        select: {
          nextSequence: true,
        },
      });

      // The sequence number obtained from upsert is the *new* nextSequence after incrementing.
      // So, the current ID should use (nextSequence - 1) if nextSequence was previously 0 and now 1.
      // If it was 1 and now 2, current ID uses 1.
      // The original logic was: const currentSequence = sequenceRecord.nextSequence; which means if it was just created (nextSequence=1), it uses 1. If it was incremented from 1 to 2, it uses 2.
      // Let's stick to the original logic which implies the 'nextSequence' is the one to be used for the current ID.
      // If nextSequence is 1 (first time for this branch/date), it's used. If it's 2 (second time), 2 is used.
      const currentSequence = sequenceRecord.nextSequence;
      const nextSequenceStr = currentSequence.toString().padStart(3, '0');
      const generatedId = `${idPrefix}${nextSequenceStr}`;
      this.logger.log(`Generated inspection ID: ${generatedId}`);
      return generatedId;

    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // This should ideally be rare with upsert, but as a safeguard
        this.logger.error(
          `Race condition or duplicate custom ID suspected for prefix ${idPrefix}. Error: ${error.message}`,
          error.stack,
        );
        throw new ConflictException(
          `Failed to generate unique inspection ID for ${idPrefix}. Please try again.`,
        );
      }
      this.logger.error(
        `Failed to generate inspection ID for branch ${branchCode} on ${datePrefix}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not generate inspection ID.');
    }
  }
}
