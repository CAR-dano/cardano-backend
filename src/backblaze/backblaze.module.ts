import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackblazeService } from './backblaze.service';

@Module({
  imports: [ConfigModule],
  providers: [BackblazeService],
  exports: [BackblazeService],
})
export class BackblazeModule {}
