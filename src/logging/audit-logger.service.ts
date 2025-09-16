import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export interface AuditEvent {
  time?: string;
  rid: string;
  actorId: string;
  actorRole?: string;
  action: string; // e.g., CREATE|READ|UPDATE|DELETE|EXPORT|LOGIN
  resource: string; // e.g., report, user, purchase
  subjectId?: string;
  tenantId?: string;
  ip?: string;
  ua?: string;
  result: 'SUCCESS' | 'FAILURE';
  reason?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditLoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(event: AuditEvent) {
    const payload = {
      audit: true,
      time: event.time ?? new Date().toISOString(),
      ...event,
    };
    this.logger.info({ channel: 'audit', ...payload }, 'audit event');
  }
}
