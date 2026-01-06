/*
 * --------------------------------------------------------------------------
 * File: main.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: The main entry point for the CAR-dano backend application.
 * Initializes the NestJS application, configures global settings like
 * prefixes, validation pipes, and CORS, and sets up Swagger documentation.
 * It also retrieves the application port from environment variables and
 * starts the server.
 * --------------------------------------------------------------------------
 */

import { NestFactory } from '@nestjs/core';
import * as dns from 'dns';
import * as fs from 'fs';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { getLoggerConfig } from './config/logger.config';

let openApiDocument: OpenAPIObject | null = null;

/**
 * Retrieves the generated OpenAPI document.
 *
 * @returns The OpenAPI document object or null if not yet generated.
 */
export function getOpenApiDocument(): OpenAPIObject | null {
  return openApiDocument;
}

/**
 * The main bootstrap function to initialize and start the NestJS application.
 */
async function bootstrap() {
  // Get logger configuration from environment
  const loggerConfig = getLoggerConfig();

  // Force IPv4 to avoid ETIMEDOUT on some networks (especially for Backblaze S3)
  dns.setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create(AppModule, {
    logger: loggerConfig.logLevels, // Set log levels from configuration
  });
  app.use(helmet());
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap - ApiGateway'); // Create a logger instance

  logger.log(
    `Logger initialized with levels: [${loggerConfig.logLevels.join(', ')}]`,
  );

  // Set payload limits
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Ensure upload directories exist
  const uploadDirs = [
    './uploads',
    './uploads/inspection-photos',
    './pdfarchived',
  ];

  uploadDirs.forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.log(`Created directory: ${dir}`);
      }
    } catch (error) {
      // Directory might already exist via volume mount or permission denied
      // Log warning but don't fail startup
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        logger.warn(
          `Permission denied creating ${dir}. Assuming directory exists via volume mount.`,
        );
      } else if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        logger.error(`Failed to create directory ${dir}:`, error);
        throw error; // Re-throw if it's not a permission or exists error
      }
    }
  });

  // Set Global Prefix
  app.setGlobalPrefix('api/v1');

  // Apply Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Ignore properties that are not in the DTO
      transform: true, // Automatically transform the payload to a DTO instance
      transformOptions: {
        enableImplicitConversion: true, // Helps implicit type conversion (e.g. string to number in query)
      },
      // forbidNonWhitelisted: true, // Reject the request if any property is not listed in the DTO
      disableErrorMessages: false, // Show validation error messages (set true in production if necessary)
    }),
  );

  // Enable CORS if frontend and backend have different origins
  // Supports multiple origins separated by comma
  const clientUrl = configService.get<string>('CLIENT_BASE_URL');
  if (clientUrl) {
    const allowedOrigins = clientUrl.split(',').map(url => url.trim());
    logger.log(`Enabling CORS for origins: ${allowedOrigins.join(', ')}`);
    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });
  } else {
    logger.warn(
      'CLIENT_BASE_URL not set in .env, enabling CORS for all origins (development only)',
    );
    app.enableCors();
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CAR-dano API') // CAR-dano API Title
    .setDescription('API documentation for the CAR-dano backend system.') // Description
    .setVersion('1.0.0') // API Version
    // Add tags to group endpoints in the documentation
    .addTag('Auth (UI Users)', 'Authentication for Internal Users')
    .addTag('User Management (Admin)', 'User management operations for Admins')
    .addTag('Inspection Data', 'Core inspection data operations')
    .addTag('Photos', 'Inspection photo management')
    .addTag('Blockchain Operations', 'Cardano NFT minting and data retrieval')
    .addTag('Inspection Branches', 'Operations related to inspection branches')
    .addTag('Inspection Change Log', 'Tracking changes to inspections')
    .addTag('Public API', 'Endpoints for public access')
    .addTag('Scalar Docs', 'Endpoints for Scalar documentation')
    .addTag('Users', 'User management operations')
    .addTag('Dashboard Admin', 'Administrator management operations')
    // Add security scheme definition if your API is protected
    .addBearerAuth(
      // For JWT
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JwtAuthGuard', // Security scheme name (use this in @ApiBearerAuth())
    )
    .build();

  // Generate OpenAPI document WITHOUT setting up the default Swagger UI
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Store the document in a global variable (optional)
  openApiDocument = document;

  const port = configService.get<number>('PORT') || 3000; // Retrieve port from .env
  await app.listen(port);
  logger.log(`🚀 API Gateway running on: http://localhost:${port}/api/v1`);
  logger.log(
    `📚 API Documentation available at: http://localhost:${port}/api/v1/docs`,
  );
  logger.log(
    `📄 OpenAPI JSON specification available at: http://localhost:${port}/api/v1/openapi.json`,
  );
}
bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});
