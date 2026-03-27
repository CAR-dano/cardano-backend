import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEvent } from './security-event.interface';
import { SecurityEventSeverity } from './security-event.enum';

/**
 * SecurityLoggerService — centralised sink for all security-relevant events.
 *
 * Each event is:
 *   1. Written to the dedicated `security_logs` database table for queryable
 *      audit trail and compliance purposes.
 *   2. Emitted to stdout via NestJS Logger so it appears in container/application
 *      logs and can be ingested by any external log aggregator (ELK, Loki, etc.).
 *
 * The DB write is fire-and-forget: failures are caught and logged as warnings so
 * that a database hiccup never interrupts the critical path (e.g., a login flow).
 */
@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger('Security');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a security event to both stdout and the `security_logs` table.
   *
   * @param event The security event to record.
   */
  async log(event: SecurityEvent): Promise<void> {
    // 1. Emit to stdout at an appropriate log level so the event shows up
    //    immediately in application logs / container stdout.
    const logLine = JSON.stringify({
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      ip: event.ip,
      details: event.details,
    });

    switch (event.severity) {
      case SecurityEventSeverity.CRITICAL:
        this.logger.error(logLine);
        break;
      case SecurityEventSeverity.WARNING:
        this.logger.warn(logLine);
        break;
      default:
        this.logger.log(logLine);
    }

    // 2. Persist to the database — fire-and-forget, never throw.
    try {
      await this.prisma.securityLog.create({
        data: {
          type: event.type,
          severity: event.severity,
          userId: event.userId ?? null,
          ip: event.ip ?? null,
          userAgent: event.userAgent ?? null,
          details: (event.details as object) ?? undefined,
        },
      });
    } catch (err) {
      // A DB write failure must never break the caller's flow.
      this.logger.warn(
        `SecurityLoggerService: failed to persist security log to DB — ` +
          `type=${event.type}, userId=${event.userId ?? 'anonymous'}. ` +
          `Error: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Convenience helper: extract IP and User-Agent from a raw Express/NestJS
   * request object and return them as a partial SecurityEvent.
   *
   * @param req Any object that may carry `ip`, `headers`, or `socket`.
   */
  extractRequestMeta(req: {
    ip?: string;
    socket?: { remoteAddress?: string };
    headers?: Record<string, string | string[] | undefined>;
  }): { ip?: string; userAgent?: string } {
    const ip =
      req.ip ??
      req.socket?.remoteAddress ??
      (req.headers?.['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim();

    const userAgent = req.headers?.['user-agent'] as string | undefined;

    return { ip, userAgent };
  }
}
