import { NestFactory } from '@nestjs/core';
import { BlockchainServiceModule } from './blockchain-service.module';

async function bootstrap() {
  const app = await NestFactory.create(BlockchainServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
