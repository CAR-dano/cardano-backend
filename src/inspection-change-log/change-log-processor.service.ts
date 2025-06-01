import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Inspection, InspectionChangeLog, Prisma, Role, User } from '@prisma/client';
import { cloneDeep } from 'lodash';

@Injectable()
export class ChangeLogProcessorService {
  private readonly logger = new Logger(ChangeLogProcessorService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Recursively logs changes in JSON structures.
   * @param fieldName - The top-level JSON field name (e.g., 'vehicleData').
   * @param oldJsonValue - The old JSON value from the database.
   * @param newJsonValue - The new JSON value from the DTO.
   * @param changes - Array to push log entries into.
   * @param inspectionId - ID of the inspection.
   * @param userId - ID of the user making the change.
   * @param path - Current path within the JSON object.
   */
  public logJsonChangesRecursive(
    fieldName: string,
    oldJsonValue: Prisma.JsonValue,
    newJsonValue: Prisma.JsonValue,
    changes: Prisma.InspectionChangeLogCreateManyInput[],
    inspectionId: string,
    userId: string,
    path: string[] = [],
  ): void {
    const isObject = (val: Prisma.JsonValue): val is Record<string, Prisma.JsonValue> =>
      typeof val === 'object' && val !== null && !Array.isArray(val);

    if (path.length >= 2 || !isObject(oldJsonValue) || !isObject(newJsonValue)) {
      if (JSON.stringify(oldJsonValue) !== JSON.stringify(newJsonValue)) {
        changes.push({
          inspectionId: inspectionId,
          changedByUserId: userId,
          fieldName: fieldName,
          subFieldName: path[0] || null,
          subsubfieldname: path[1] || null,
          oldValue: oldJsonValue === undefined || oldJsonValue === null ? Prisma.JsonNull : oldJsonValue,
          newValue: newJsonValue === undefined || newJsonValue === null ? Prisma.JsonNull : newJsonValue,
        });
      }
      return;
    }

    const oldObj = oldJsonValue as Record<string, Prisma.JsonValue>;
    const newObj = newJsonValue as Record<string, Prisma.JsonValue>;

    for (const key of Object.keys(newObj)) {
      const currentPathWithKey = [...path, key];
      this.logJsonChangesRecursive(
        fieldName,
        oldObj[key],
        newObj[key],
        changes,
        inspectionId,
        userId,
        currentPathWithKey,
      );
    }
    // Consider also iterating over keys in oldObj not in newObj if "deletions" should be logged
    // For now, matches original behavior of only logging changes/additions from newObj.
  }

  /**
   * Fetches and processes change logs to get the latest value for each field path.
   * @param inspectionId - The ID of the inspection.
   * @param tx - Prisma transaction client.
   * @returns A map where keys are field paths and values are the latest change log entries.
   */
  public async getLatestChangesMapForApproval(
     inspectionId: string,
     tx: Prisma.TransactionClient,
   ): Promise<Map<string, InspectionChangeLog>> {
     this.logger.debug(`Fetching latest changes for approval for inspection: ${inspectionId}`);
     const allChanges = await tx.inspectionChangeLog.findMany({
       where: { inspectionId: inspectionId },
       orderBy: { changedAt: 'desc' }, // Latest first
     });

     const latestChangesMap = new Map<string, InspectionChangeLog>();
     for (const log of allChanges) {
       let key = log.fieldName;
       if (log.subFieldName) {
         key += `.${log.subFieldName}`;
         if (log.subsubfieldname) {
           key += `.${log.subsubfieldname}`;
         }
       }
       if (!latestChangesMap.has(key)) {
         latestChangesMap.set(key, log);
       }
     }
     this.logger.debug(`Found ${latestChangesMap.size} unique latest changes for inspection ${inspectionId}`);
     return latestChangesMap;
   }

  /**
   * Builds the Prisma.InspectionUpdateInput object by applying the latest changes
   * from the change log to the current inspection data. Ensures data preservation for nested JSON.
   * @param inspection - The current inspection object from the database.
   * @param latestChangesMap - Map of latest changes from getLatestChangesMapForApproval.
   * @param initialUpdateData - Initial Prisma.InspectionUpdateInput (e.g., for status, reviewerId).
   * @returns The comprehensive Prisma.InspectionUpdateInput object.
   */
   public buildUpdateDataFromChanges(
     inspection: Inspection, // Full inspection object from DB
     latestChangesMap: Map<string, InspectionChangeLog>,
     initialUpdateData: Prisma.InspectionUpdateInput, // Initial data like status, reviewer
   ): Prisma.InspectionUpdateInput {
     this.logger.debug(`Building update data for inspection ID: ${inspection.id} based on ${latestChangesMap.size} changes.`);
     // Start with a deep clone of the initial update data to avoid modifying it directly.
     const updateData = cloneDeep(initialUpdateData);

     // Define which top-level fields in Inspection are JSON and need careful merging.
     // These should align with how they are logged and structured.
     const jsonMergeFields: (keyof Inspection)[] = [
       'identityDetails', 'vehicleData', 'equipmentChecklist',
       'inspectionSummary', 'detailedAssessment', 'bodyPaintThickness', 'notesFontSizes'
     ];

     for (const [fieldKey, changeLog] of latestChangesMap) {
       const newValue = changeLog.newValue; // This is Prisma.JsonValue
       const parts = fieldKey.split('.');
       const topLevelFieldName = parts[0] as keyof Inspection;

       this.logger.verbose(`Processing change for fieldKey: ${fieldKey}, value: ${JSON.stringify(newValue)}`);

       if (parts.length === 1) { // Top-level field
         if (topLevelFieldName === 'inspector' && newValue !== null && typeof newValue === 'string') {
           updateData.inspector = { connect: { id: newValue } };
         } else if (topLevelFieldName === 'branchCity' && newValue !== null && typeof newValue === 'string') {
           updateData.branchCity = { connect: { id: newValue } };
         } else if (Object.prototype.hasOwnProperty.call(inspection, topLevelFieldName) && !(jsonMergeFields as string[]).includes(topLevelFieldName)) {
           // Direct update for non-JSON, non-relational top-level fields
           if (topLevelFieldName === 'inspectionDate' && typeof newValue === 'string') {
             updateData.inspectionDate = new Date(newValue);
           } else if (newValue !== Prisma.JsonNull) {
              (updateData as any)[topLevelFieldName] = newValue;
           } else {
              (updateData as any)[topLevelFieldName] = null;
           }
         } else if (!(jsonMergeFields as string[]).includes(topLevelFieldName)) {
           this.logger.warn(`Top-level field '${topLevelFieldName}' from changelog (key: ${fieldKey}) is not a direct property of Inspection or a known JSON field. Ignoring.`);
         }
         // JSON fields at top level (parts.length === 1) are handled by the parts.length > 1 logic if subkeys are specified,
         // or need specific handling if the entire JSON object is replaced.
         // The current logJsonChangesRecursive logs individual fields, so this case might be rare for full JSON object replacement.
       }

       // Handling for JSON fields (potentially nested)
       if ((jsonMergeFields as string[]).includes(topLevelFieldName)) {
         // Ensure the top-level JSON field exists in updateData, initializing from current inspection data if necessary.
         if (!updateData[topLevelFieldName] || typeof updateData[topLevelFieldName] !== 'object') {
           // Initialize with a deep clone of the existing value from the inspection
           updateData[topLevelFieldName] = cloneDeep(inspection[topLevelFieldName]) ?? {};
         }

         let currentLevel = updateData[topLevelFieldName] as Prisma.JsonObject;

         for (let i = 1; i < parts.length; i++) {
           const part = parts[i];
           if (i === parts.length - 1) { // Last part, set the value
             if (newValue === Prisma.JsonNull) {
               currentLevel[part] = null;
             } else {
               currentLevel[part] = newValue;
             }
           } else { // Navigate deeper
             if (!currentLevel[part] || typeof currentLevel[part] !== 'object') {
               // If path doesn't exist or not an object, create it.
               // Also clone from original inspection if exists there to preserve siblings
               const originalPathValue = (cloneDeep(inspection[topLevelFieldName]) as Prisma.JsonObject)?.[part];
               currentLevel[part] = typeof originalPathValue === 'object' ? originalPathValue : {};
             }
             currentLevel = currentLevel[part] as Prisma.JsonObject;
           }
         }
       }
     }
     this.logger.debug(`Final updateData for inspection ${inspection.id}: ${JSON.stringify(updateData)}`);
     return updateData;
   }
}
