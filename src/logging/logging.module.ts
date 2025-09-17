import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { AuditLoggerService } from './audit-logger.service';
import { GlobalExceptionFilter } from './global-exception.filter';
import { AppLogger } from './app-logger.service';

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'headers.authorization',
            'password',
            '*.password',
            'token',
            'accessToken',
            'refreshToken',
            'secret',
            'privateKey',
          ],
          remove: true,
        },
        genReqId: (req: any) => req.id || req.headers['x-request-id'],
        customProps: (req: any) => ({
          requestId: req?.id,
          userId: req?.user?.id,
          tenantId: req?.user?.tenantId,
          ip: req?.ip,
        }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { colorize: true, singleLine: true },
              },
      },
    }),
  ],
  providers: [
    HttpLoggingInterceptor,
    AuditLoggerService,
    GlobalExceptionFilter,
    AppLogger,
  ],
  exports: [
    HttpLoggingInterceptor,
    AuditLoggerService,
    GlobalExceptionFilter,
    AppLogger,
    LoggerModule,
  ],
})
export class AppLoggingModule {}
