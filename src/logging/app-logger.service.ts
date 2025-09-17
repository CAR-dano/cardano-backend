import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class AppLogger {
  constructor(private readonly pino: PinoLogger) {}

  setContext(context: string) {
    this.pino.setContext?.(context as any);
  }

  // Aliases to ease migration from Nest Logger
  log(message: any, ...optionalParams: any[]) {
    this.pino.info(message, ...optionalParams);
  }
  verbose(message: any, ...optionalParams: any[]) {
    this.pino.debug(message, ...optionalParams);
  }
  debug(message: any, ...optionalParams: any[]) {
    this.pino.debug(message, ...optionalParams);
  }
  info(message: any, ...optionalParams: any[]) {
    this.pino.info(message, ...optionalParams);
  }
  warn(message: any, ...optionalParams: any[]) {
    this.pino.warn(message, ...optionalParams);
  }
  error(message: any, ...optionalParams: any[]) {
    this.pino.error(message, ...optionalParams);
  }
}
