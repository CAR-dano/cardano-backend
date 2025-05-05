import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule

@Global() // Make PrismaService available globally
@Module({
  imports: [ConfigModule], // PrismaService needs ConfigService
  providers: [PrismaService],
  exports: [PrismaService], // Export so that it can be injected in other modules
})
export class PrismaModule {}
