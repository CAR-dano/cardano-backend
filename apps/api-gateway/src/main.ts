import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { Logger } from '@nestjs/common'; 

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  const port = process.env.PORT || 3000; // Use environment variable or default
  const logger = new Logger('Bootstrap - ApiGateway'); // Create a logger instance

  await app.listen(port);

  // Log the application URL and the documentation URL
  logger.log(`🚀 API Gateway running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api-docs`);
}
bootstrap();