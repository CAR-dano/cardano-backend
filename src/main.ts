import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

let openApiDocument: OpenAPIObject | null = null;

export function getOpenApiDocument(): OpenAPIObject | null {
  return openApiDocument;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap - ApiGateway'); // Create a logger instance

  // Set Global Prefix
  app.setGlobalPrefix('api/v1');

  // Apply Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: true, // Ignore properties that are not in the DTO
      transform: true, // Automatically transform the payload to a DTO instance
      transformOptions: {
        enableImplicitConversion: true, // Helps implicit type conversion (e.g. string to number in query)
      },
      // forbidNonWhitelisted: true, // Reject the request if any property is not listed in the DTO
      disableErrorMessages: false, // Show validation error messages (set true in production if necessary)
    }),
  );

  // Enable CORS if frontend and backend have different origins
  const clientUrl = configService.get<string>('CLIENT_BASE_URL');
  if (clientUrl) {
    logger.log(`Enabling CORS for origin: ${clientUrl}`);
    app.enableCors({
      origin: clientUrl,
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
    .setTitle('CAR-dano API') // Judul API Anda
    .setDescription('API documentation for the CAR-dano backend system.') // Deskripsi
    .setVersion('1.0.0') // Versi API
    // Tambahkan tag untuk mengelompokkan endpoint di dokumentasi
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
    // Tambahkan definisi skema keamanan jika API Anda terproteksi
    .addBearerAuth(
      // Untuk JWT
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JwtAuthGuard', // Nama skema keamanan (gunakan ini di @ApiBearerAuth())
    )
    .build();

  // Generate dokumen OpenAPI TANPA men-setup UI Swagger bawaan
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Simpan dokumen ke variabel global (opsional)
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
bootstrap();
