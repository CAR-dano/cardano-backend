import {
  SecurityEventSeverity,
  SecurityEventType,
} from './security-event.enum';

/**
 * Describes a single security event to be logged.
 */
export interface SecurityEvent {
  /** The type of security event that occurred. */
  type: SecurityEventType;

  /** Severity classification of the event. */
  severity: SecurityEventSeverity;

  /** ID of the user involved (if known at the time of the event). */
  userId?: string;

  /** Client IP address extracted from the request. */
  ip?: string;

  /** Raw User-Agent string from the request. */
  userAgent?: string;

  /**
   * Arbitrary structured details about the event.
   * Must be JSON-serialisable. Avoid including secrets or PII.
   */
  details?: Record<string, unknown>;
}
