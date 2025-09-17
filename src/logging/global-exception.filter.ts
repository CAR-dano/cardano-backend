import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req: any = ctx.getRequest();
    const res: any = ctx.getResponse();

    const isHttp = exception instanceof HttpException;
    const status: number = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Build safe client response
    const base: HttpErrorResponseDto = {
      statusCode: status,
      message: 'An unexpected error occurred',
      error: HttpStatus[status] || 'Error',
      path: req?.originalUrl || req?.url,
      timestamp: new Date().toISOString(),
    };

    if (isHttp) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        base.message = resp;
        base.error = (exception as any)?.name || base.error;
      } else if (resp && typeof resp === 'object') {
        const obj: any = resp;
        base.message = obj.message ?? base.message;
        base.error = obj.error ?? (exception as any)?.name ?? base.error;
      }
    } else {
      // Hide implementation details from clients
      base.message = 'Internal server error';
      base.error = 'Internal Server Error';
    }

    // Normalize Validation (400) messages to array of strings
    if (status === HttpStatus.BAD_REQUEST) {
      const normalizeToArray = (val: unknown): string[] => {
        if (Array.isArray(val)) return val.map((v) => String(v));
        if (val == null) return ['Bad Request'];
        return [String(val)];
      };
      base.message = normalizeToArray((base as any).message);
    }

    // Log structured error (with correlation id if present)
    const logPayload = {
      rid: req?.id || req?.headers?.['x-request-id'],
      method: req?.method,
      url: req?.originalUrl || req?.url,
      statusCode: status,
      userId: req?.user?.id,
      ip: req?.ip,
      name: (exception as any)?.name,
      message: (exception as any)?.message ?? base.message,
      stack: (exception as any)?.stack,
    };

    if (status >= 500) this.logger.error(logPayload, 'unhandled error');
    else this.logger.warn(logPayload, 'handled http error');

    if (res.headersSent) {
      // Fallback: do not attempt to write if response already started
      return;
    }

    res.status(status).json(base);
  }
}
