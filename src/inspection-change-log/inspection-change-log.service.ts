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

    return this.prisma.inspectionChangeLog.findMany({
      where: { inspectionId: inspectionId },
      orderBy: { changedAt: 'asc' }, // Order by timestamp
    });
  }

  /**
   * Deletes a specific change log entry by its ID.
   *
   * @param id The ID of the change log entry to delete.
   * @returns A promise that resolves to the deleted InspectionChangeLog object.
   * @throws NotFoundException if the change log entry with the given ID does not exist.
   */
  async delete(id: string): Promise<InspectionChangeLog> {
    const changeLog = await this.prisma.inspectionChangeLog.findUnique({
      where: { id },
    });

    if (!changeLog) {
      throw new NotFoundException(`Change log with ID "${id}" not found.`);
    }

    return this.prisma.inspectionChangeLog.delete({
      where: { id },
    });
  }
}
