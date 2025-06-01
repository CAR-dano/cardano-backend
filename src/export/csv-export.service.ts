import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';
// Inspection type might be needed if you are strongly typing the 'inspectionsFromDb'
import { Inspection } from '@prisma/client'; // Or your specific DTO/interface

@Injectable()
export class CsvExportService {
  private readonly logger = new Logger(CsvExportService.name);

  constructor(private prisma: PrismaService) {}

  private flattenObject(
    obj: any,
    parentKey = '',
    result: Record<string, any> = {},
  ): Record<string, any> {
    if (obj === null || (typeof obj !== 'object' && !Array.isArray(obj))) {
      result[parentKey || 'value'] = obj;
      return result;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = parentKey ? `${parentKey}_${key}` : key;
        const value = obj[key];

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          this.flattenObject(value, newKey, result);
        } else if (Array.isArray(value)) {
          // Simplified array handling for CSV - join simple arrays, special for estimasiPerbaikan
          if (
            newKey.endsWith('estimasiPerbaikan') &&
            value.length > 0 &&
            typeof value[0] === 'object' && value[0] !== null && 'namaPart' in value[0] && 'harga' in value[0]
          ) {
            result[newKey] = value
              .map((item: any) => `${item.namaPart || 'N/A'}:${item.harga || 'N/A'}`)
              .join(' | ');
          } else if (
            value.every(
              (item) =>
                typeof item === 'string' ||
                typeof item === 'number' ||
                typeof item === 'boolean' ||
                item === null, // Allow nulls
            )
          ) {
            result[newKey] = value.join('|');
          } else {
            result[newKey] = JSON.stringify(value); // Fallback for complex arrays
          }
        } else {
          result[newKey] = value;
        }
      }
    }
    return result;
  }

  public async exportInspectionsToCsv(): Promise<{
    filename: string;
    csvData: string;
  }> {
    this.logger.log('Exporting all inspection data to CSV via CsvExportService');

    try {
      const inspectionsFromDb = await this.prisma.inspection.findMany({
        include: {
          inspector: { select: { name: true } },
          reviewer: { select: { name: true } },
          branchCity: { select: { city: true, code: true } },
          // Do not include 'photos' relation if it's heavy and not needed for CSV
        },
      });

      if (!inspectionsFromDb || inspectionsFromDb.length === 0) {
        this.logger.log('No inspection data available for CSV export.');
        return {
          filename: `inspections_empty_${new Date().toISOString().split('T')[0]}.csv`,
          csvData: 'No inspection data available.',
        };
      }

      const processedData = inspectionsFromDb.map((inspection) => {
        const flatData: Record<string, any> = {};

        // Add fields from relations
        flatData['inspectorName'] = inspection.inspector?.name || '';
        flatData['reviewerName'] = inspection.reviewer?.name || '';
        flatData['branchCityName'] = inspection.branchCity?.city || '';
        flatData['branchCode'] = inspection.branchCity?.code || '';

        // Top-level fields to exclude (already handled or JSON to be flattened)
        const topLevelFieldsToExclude = [
          'inspector', 'reviewer', 'branchCity', 'inspectorId', 'reviewerId', 'branchCityId', // IDs are less useful if names are present
          'identityDetails', 'vehicleData', 'equipmentChecklist',
          'inspectionSummary', 'detailedAssessment', 'bodyPaintThickness',
          'photos', 'notesFontSizes', // 'photos' relation/JSON is excluded
        ];

        for (const key in inspection) {
          if (
            Object.prototype.hasOwnProperty.call(inspection, key) &&
            !topLevelFieldsToExclude.includes(key)
          ) {
            const typedKey = key as keyof Inspection;
            if (inspection[typedKey] instanceof Date) {
              flatData[key] = (inspection[typedKey] as Date).toISOString();
            } else {
              flatData[key] = inspection[typedKey];
            }
          }
        }

        // Flatten JSON fields (adjust according to your actual Prisma model)
        const jsonFieldsToFlatten: { [key: string]: any } = {
          identityDetails: inspection.identityDetails,
          vehicleData: inspection.vehicleData,
          equipmentChecklist: inspection.equipmentChecklist,
          inspectionSummary: inspection.inspectionSummary,
          detailedAssessment: inspection.detailedAssessment,
          bodyPaintThickness: inspection.bodyPaintThickness,
          notesFontSizes: inspection.notesFontSizes,
        };

        for (const parentKey in jsonFieldsToFlatten) {
          if (Object.prototype.hasOwnProperty.call(jsonFieldsToFlatten, parentKey)) {
            const jsonObject = jsonFieldsToFlatten[parentKey];
            if (jsonObject && typeof jsonObject === 'object') {
              this.flattenObject(jsonObject, parentKey, flatData);
            } else if (jsonObject !== undefined && jsonObject !== null) {
              flatData[parentKey] = jsonObject;
            }
          }
        }
        // Ensure photos are not accidentally included if they were part of a JSON blob
        delete flatData['photos'];

        return flatData;
      });

      const allKeys = new Set<string>();
      processedData.forEach((item) => {
        Object.keys(item).forEach((key) => allKeys.add(key));
      });
      const sortedHeaders = Array.from(allKeys).sort();

      const csvData = Papa.unparse(processedData, {
        columns: sortedHeaders,
        header: true,
      });

      const filename = `inspections_export_${new Date().toISOString().split('T')[0]}.csv`;
      this.logger.log(`CSV data generated successfully. Filename: ${filename}`);
      return { filename, csvData };

    } catch (error: any) {
      this.logger.error(
        `Failed to export inspections to CSV: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not export inspection data to CSV.');
    }
  }
}
