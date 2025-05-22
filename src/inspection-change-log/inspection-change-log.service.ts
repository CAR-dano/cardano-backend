/*
 * --------------------------------------------------------------------------
 * File: inspection-change-log.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service responsible for managing inspection change logs.
 * Provides methods to retrieve and delete change logs.
 * --------------------------------------------------------------------------
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InspectionChangeLog } from '@prisma/client';

@Injectable()
export class InspectionChangeLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves change logs for a specific inspection.
   *
   * @param inspectionId The ID of the inspection.
   * @returns A promise that resolves to an array of InspectionChangeLog objects.
   * @throws NotFoundException if the inspection does not exist (optional, depending on desired behavior).
   */
  async findByInspectionId(
    inspectionId: string,
  ): Promise<InspectionChangeLog[]> {
    // Optional: Check if the inspection exists first if you want to throw NotFoundException
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection) {
      throw new NotFoundException(
        `Inspection with ID "${inspectionId}" not found.`,
      );
    }

    const changeLogs = await this.prisma.inspectionChangeLog.findMany({
      where: { inspectionId: inspectionId },
      orderBy: { changedAt: 'desc' }, // Order by timestamp descending (latest first)
    });

    const latestChangeLogsMap = new Map<string, InspectionChangeLog>();

    for (const log of changeLogs) {
      const key = `${log.fieldName}-${log.subFieldName}-${log.subsubfieldname}`;
      if (!latestChangeLogsMap.has(key)) {
        latestChangeLogsMap.set(key, log);
      }
    }

    return Array.from(latestChangeLogsMap.values());
  }
}
