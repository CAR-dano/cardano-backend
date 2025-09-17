import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();

    const method: string = req?.method;
    const url: string = req?.originalUrl || req?.url;
    const rid: string | undefined = req?.id || req?.headers?.['x-request-id'];
    const userId: string | undefined = req?.user?.id;
    const tenantId: string | undefined = req?.user?.tenantId;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - now;
          const statusCode = res?.statusCode;
          this.logger.info(
            { rid, userId, tenantId, method, url, statusCode, ms },
            'request completed',
          );
        },
        error: (err) => {
          const ms = Date.now() - now;
          const statusCode = res?.statusCode;
          this.logger.error(
            { rid, userId, tenantId, method, url, statusCode, ms, err },
            'request failed',
          );
        },
      }),
    );
  }
}
