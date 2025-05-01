/**
 * @fileoverview Service responsible for handling business logic related to inspections.
 * Interacts with PrismaService to manage inspection data in the database.
 * Handles parsing JSON data received as strings and storing file paths from uploads.
 * Authentication details (like associating with a real user) are currently using placeholders or omitted.
 */

import { Injectable, Logger, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Service for Prisma client interaction
import { CreateInspectionDto } from './dto/create-inspection.dto'; // DTO for incoming creation data
import { Inspection, Prisma } from '@prisma/client'; // Prisma generated types (Inspection model, Prisma namespace)

@Injectable()
export class InspectionsService {
  // Initialize a logger for this service context
  private readonly logger = new Logger(InspectionsService.name);

  // Inject PrismaService dependency via constructor
  constructor(private prisma: PrismaService) { }

  /**
   * Private helper function to safely parse a JSON string.
   * This is used because the DTO receives JSON data as strings from multipart/form-data.
   *
   * - If the input string is undefined, null, or empty after trimming, it returns `undefined`.
   *   This signals Prisma to store database NULL for the optional `Json?` field.
   * - If the input string represents the JSON literal `null`, it returns `undefined` as well (to store DB NULL).
   *   Alternatively, could return `Prisma.JsonNull` if explicit JSON null is desired AND the schema field is non-nullable (`Json`).
   * - If the JSON string is invalid, it logs an error and throws a `BadRequestException`.
   * - If parsing is successful, it returns the parsed JavaScript object/value, cast to `Prisma.InputJsonValue`.
   *
   * @param {string | undefined} jsonString - The JSON string received from the DTO.
   * @param {string} fieldName - The name of the field being parsed (for logging).
   * @returns {Prisma.InputJsonValue | undefined} The parsed JSON value or undefined.
   * @throws {BadRequestException} If the jsonString is invalid JSON.
   */
  private parseJsonField(jsonString: string | undefined, fieldName: string): Prisma.InputJsonValue | undefined {
    // Check if the input string is effectively empty
    if (jsonString === undefined || jsonString === null || jsonString.trim() === '') {
      this.logger.verbose(`JSON field '${fieldName}' is empty or nullish. Will result in DB NULL.`);
      return undefined; // Return undefined for optional fields to store NULL
    }
    try {
      // Attempt to parse the JSON string
      const parsed = JSON.parse(jsonString);

      // Handle the case where the valid JSON literal 'null' was parsed
      if (parsed === null) {
        this.logger.verbose(`Parsed JSON field '${fieldName}' resulted in null. Will result in DB NULL.`);
        return undefined; // Treat JSON null as DB NULL for optional Json? fields
        // To store actual JSON null: return Prisma.JsonNull; (requires schema field to be non-nullable Json)
      }

      // Basic check for valid JSON types (optional, Prisma might handle this)
      // const validTypes = ['object', 'string', 'number', 'boolean'];
      // if (!validTypes.includes(typeof parsed) && !Array.isArray(parsed)) {
      //   throw new Error('Parsed value is not a valid JSON-compatible type.');
      // }

      // Return the parsed value, cast to the type Prisma expects for JSON input
      return parsed as Prisma.InputJsonValue;
    } catch (error) {
      // Log the parsing error and throw a user-friendly exception
      this.logger.error(`Failed to parse JSON for field ${fieldName}. Input: "${jsonString}"`, error.stack);
      throw new BadRequestException(`Invalid JSON format provided for field '${fieldName}'.`);
    }
  }

  /**
   * Creates a new inspection record in the database.
   * Takes the DTO containing basic info and stringified JSON, and optional uploaded files.
   * Parses the JSON strings and constructs the data payload for Prisma.
   * Currently sets the user relation to null (or connects to a dummy ID if configured).
   *
   * @param {CreateInspectionDto} createInspectionDto - The DTO containing inspection data (JSON fields as strings).
   * @param {Express.Multer.File[]} [photos] - Optional array of uploaded photo file objects from Multer.
   * @returns {Promise<Inspection>} A promise resolving to the newly created inspection record.
   * @throws {BadRequestException} If any JSON field has an invalid format.
   * @throws {InternalServerErrorException} If the database operation fails for other reasons.
   */
  async create(
    createInspectionDto: CreateInspectionDto,
    photos?: Express.Multer.File[], // Multer file array (optional)
  ): Promise<Inspection> {
    // Log the raw DTO received for debugging
    this.logger.debug('Raw DTO received by Service:', JSON.stringify(createInspectionDto, null, 2));
    this.logger.log(`Attempting to create inspection for plate: ${createInspectionDto.vehiclePlateNumber ?? 'N/A'}`);

    // Extract filenames from uploaded files (or empty array if no files)
    const photoPaths = photos?.map(file => file.filename) ?? [];
    if (photos && photos.length > 0) {
      this.logger.debug(`Photo filenames to store: ${photoPaths.join(', ')}`);
    }

    try {
      // Parse all the stringified JSON fields using the helper function
      const identityData = this.parseJsonField(createInspectionDto.identityDetails, 'identityDetails');
      const vehicleDataParsed = this.parseJsonField(createInspectionDto.vehicleData, 'vehicleData');
      const equipmentData = this.parseJsonField(createInspectionDto.equipmentChecklist, 'equipmentChecklist');
      const summaryData = this.parseJsonField(createInspectionDto.inspectionSummary, 'inspectionSummary');
      const assessmentData = this.parseJsonField(createInspectionDto.detailedAssessment, 'detailedAssessment');

      // Log the parsed data for debugging
      this.logger.debug('Parsed JSON Data for DB:', { identityData, vehicleDataParsed, equipmentData, summaryData, assessmentData });

      // Construct the data object for Prisma's `create` method
      // Use the specific Prisma.InspectionCreateInput type for type safety
      const dataToCreate: Prisma.InspectionCreateInput = {
        // Handle user relation: Set to null for now as FK is optional
        // If you have a dummy user ID and the relation is required, use connect:
        // submittedByUser: { connect: { id: 'YOUR_DUMMY_USER_ID_HERE' } },
        // submittedByUserId: undefined, // Explicitly undefined means Prisma won't try to set it

        // Assign basic fields from DTO
        vehiclePlateNumber: createInspectionDto.vehiclePlateNumber,
        // Convert date string to Date object, or undefined if not provided
        inspectionDate: createInspectionDto.inspectionDate ? new Date(createInspectionDto.inspectionDate) : undefined,
        overallRating: createInspectionDto.overallRating,

        // Assign parsed JSON objects (or undefined/JsonNull) to the corresponding Json fields
        identityDetails: identityData,
        vehicleData: vehicleDataParsed,
        equipmentChecklist: equipmentData,
        inspectionSummary: summaryData,
        detailedAssessment: assessmentData,

        // Assign the array of photo filenames
        photoPaths: photoPaths,

        // Other fields like nftAssetId, transactionHash will default to null based on schema
      };

      // Log the final data object being sent to Prisma for debugging
      this.logger.debug('Data prepared for Prisma create:', JSON.stringify(dataToCreate, null, 2));

      // Execute the Prisma create query
      const newInspection = await this.prisma.inspection.create({ data: dataToCreate });

      this.logger.log(`Successfully created inspection with ID: ${newInspection.id}`);
      // Return the complete Inspection object created by Prisma
      // Note: JSON fields in the returned object will be actual JavaScript objects/arrays
      return newInspection;
    } catch (error) {
      // Re-throw BadRequestException if it came from parseJsonField
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log other errors and throw a generic server error
      this.logger.error(`Failed to create inspection in database: ${error.message}`, error.stack);
      // Consider checking for specific Prisma error codes (e.g., unique constraint violation)
      throw new InternalServerErrorException('Could not save inspection data to the database.');
    }
  }

  /**
   * Retrieves all inspection records from the database.
   * Currently fetches all records without pagination or filtering.
   * Returns the full Inspection object including JSON fields as objects.
   *
   * @returns {Promise<Inspection[]>} A promise resolving to an array of all inspection records.
   * @throws {InternalServerErrorException} If the database query fails.
   */
  async findAll(): Promise<Inspection[]> {
    this.logger.log('Retrieving all inspections (no pagination)');
    try {
      // Use Prisma findMany to get all records
      const inspections = await this.prisma.inspection.findMany({
        // Optionally add 'orderBy' or 'include' clauses here later
        // orderBy: { createdAt: 'desc' },
        // include: { submittedByUser: { select: { id: true, name: true } } } // Example include
      });
      this.logger.log(`Retrieved ${inspections.length} inspections.`);
      return inspections; // Return the array of Inspection objects
    } catch (error) {
      // Log error and throw a generic exception
      this.logger.error(`Failed to retrieve inspections from database: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not retrieve inspection data from the database.');
    }
  }

  /**
   * Retrieves a single inspection record by its unique ID (UUID).
   * Throws NotFoundException if no record matches the ID.
   * Returns the full Inspection object including JSON fields.
   *
   * @param {string} id - The UUID of the inspection to retrieve.
   * @returns {Promise<Inspection>} The found inspection record.
   * @throws {NotFoundException} If the inspection with the given ID does not exist.
   * @throws {InternalServerErrorException} If there is a database query error.
   */
  async findOne(id: string): Promise<Inspection> {
    this.logger.log(`Retrieving inspection with ID: ${id}`);
    try {
      // findUniqueOrThrow will throw an error if not found (PrismaClientKnownRequestError P2025)
      const inspection = await this.prisma.inspection.findUniqueOrThrow({
        where: { id: id },
        // Optionally include related data:
        // include: { submittedByUser: { select: { id: true, name: true, email: true } } }
      });
      this.logger.log(`Found inspection with ID: ${id}`);
      return inspection; // Prisma already returns JSON fields as objects
    } catch (error) {
      // Check if the error is the specific Prisma error for record not found
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        this.logger.warn(`Inspection with ID "${id}" not found.`);
        throw new NotFoundException(`Inspection with ID "${id}" not found.`);
      }
      // Handle other potential database errors
      this.logger.error(`Failed to retrieve inspection with ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Could not retrieve inspection with ID ${id}.`);
    }
  }
}