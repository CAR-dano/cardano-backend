import { NestFactory } from '@nestjs/core';
import { ReportServiceModule } from './report-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ReportServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
