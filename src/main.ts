import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap - ApiGateway'); // Create a logger instance

  // Set Global Prefix
  app.setGlobalPrefix('api/v1');

  // Apply Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    // whitelist: true, // Ignore properties that are not in the DTO
    transform: true, // Automatically transform the payload to a DTO instance
    transformOptions: {
      enableImplicitConversion: true, // Helps implicit type conversion (e.g. string to number in query)
    },
    // forbidNonWhitelisted: true, // Reject the request if any property is not listed in the DTO
    disableErrorMessages: false, // Show validation error messages (set true in production if necessary)
  }));

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
      logger.warn('CLIENT_BASE_URL not set in .env, enabling CORS for all origins (development only)');
      app.enableCors();
  }

  const port = configService.get<number>('PORT') || 3000; // Retrieve port from .env
  await app.listen(port);
  logger.log(`🚀 API Gateway running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api/v1/api-docs`);
}
bootstrap();