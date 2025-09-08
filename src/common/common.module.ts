import { Global, Module } from '@nestjs/common';
import { BackblazeService } from './services/backblaze.service';

@Global()
@Module({
  providers: [BackblazeService],
  exports: [BackblazeService],
})
export class CommonModule {}
