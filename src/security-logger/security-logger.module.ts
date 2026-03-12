import { Module } from '@nestjs/common';
import { SecurityLoggerService } from './security-logger.service';

/**
 * SecurityLoggerModule — provides SecurityLoggerService globally.
 *
 * Import this module once in AppModule; it re-exports SecurityLoggerService
 * so any other module that imports SecurityLoggerModule can inject it.
 */
@Module({
  providers: [SecurityLoggerService],
  exports: [SecurityLoggerService],
})
export class SecurityLoggerModule {}
