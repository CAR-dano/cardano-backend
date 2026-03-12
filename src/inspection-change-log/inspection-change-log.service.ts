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
    // Single query: fetch inspection with its change logs in one round-trip.
    // Throws NotFoundException if inspection does not exist.
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: {
        changeLogs: {
          orderBy: { changedAt: 'desc' },
        },
      },
    });
    if (!inspection) {
      throw new NotFoundException(
        `Inspection with ID "${inspectionId}" not found.`,
      );
    }

    const changeLogs = inspection.changeLogs;

    const latestChangeLogsMap = new Map<string, InspectionChangeLog>();

    for (const log of changeLogs) {
      const key = `${log.fieldName}-${log.subFieldName}-${log.subsubfieldname}`;
      if (!latestChangeLogsMap.has(key)) {
        latestChangeLogsMap.set(key, log);
      }
    }

    return Array.from(latestChangeLogsMap.values());
  }

  /**
   * Deletes a specific change log entry.
   *
   * @param inspectionId The ID of the inspection.
   * @param changeLogId The ID of the change log to delete.
   * @returns A promise that resolves to the deleted InspectionChangeLog object.
   * @throws NotFoundException if the change log entry does not exist.
   */
  async remove(
    inspectionId: string,
    changeLogId: string,
  ): Promise<InspectionChangeLog> {
    const changeLog = await this.prisma.inspectionChangeLog.findFirst({
      where: {
        id: changeLogId,
        inspectionId: inspectionId,
      },
    });

    if (!changeLog) {
      throw new NotFoundException(
        `Change log with ID "${changeLogId}" not found for inspection "${inspectionId}".`,
      );
    }

    return this.prisma.inspectionChangeLog.delete({
      where: { id: changeLogId },
    });
  }
}
