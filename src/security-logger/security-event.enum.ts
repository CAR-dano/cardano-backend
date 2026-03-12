/**
 * Enumeration of all security event types tracked by the SecurityLoggerService.
 *
 * Convention:
 *   <ENTITY>_<ACTION>_<OUTCOME>
 */
export enum SecurityEventType {
  // ── Authentication ──────────────────────────────────────────────────────────
  /** User successfully authenticated via email/username + password */
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  /** Authentication failed due to wrong password */
  LOGIN_FAILURE_BAD_PASSWORD = 'LOGIN_FAILURE_BAD_PASSWORD',
  /** Authentication attempt for a user that does not exist */
  LOGIN_FAILURE_USER_NOT_FOUND = 'LOGIN_FAILURE_USER_NOT_FOUND',
  /** Login attempt for an inactive / disabled account */
  LOGIN_FAILURE_INACTIVE_ACCOUNT = 'LOGIN_FAILURE_INACTIVE_ACCOUNT',
  /** Inspector successfully authenticated via email + PIN */
  INSPECTOR_LOGIN_SUCCESS = 'INSPECTOR_LOGIN_SUCCESS',
  /** Inspector authentication failed (wrong PIN, not found, inactive) */
  INSPECTOR_LOGIN_FAILURE = 'INSPECTOR_LOGIN_FAILURE',
  /** User authenticated via Google OAuth */
  GOOGLE_LOGIN_SUCCESS = 'GOOGLE_LOGIN_SUCCESS',

  // ── Session / Token ─────────────────────────────────────────────────────────
  /** User voluntarily logged out from the current device */
  LOGOUT = 'LOGOUT',
  /** All sessions revoked (POST /auth/logout-all or forced by admin) */
  LOGOUT_ALL_SESSIONS = 'LOGOUT_ALL_SESSIONS',
  /** Access/refresh token pair successfully rotated */
  TOKEN_ROTATED = 'TOKEN_ROTATED',
  /** Access token rejected because it has been blacklisted */
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',
  /** Access token rejected due to sessionVersion mismatch */
  TOKEN_INVALIDATED_SESSION_VERSION = 'TOKEN_INVALIDATED_SESSION_VERSION',

  // ── User Management ─────────────────────────────────────────────────────────
  /** New user account created */
  USER_CREATED = 'USER_CREATED',
  /** User account deleted */
  USER_DELETED = 'USER_DELETED',
  /** User's role changed by an admin */
  ROLE_CHANGED = 'ROLE_CHANGED',
  /** User's account activated or deactivated */
  ACCOUNT_STATUS_CHANGED = 'ACCOUNT_STATUS_CHANGED',
  /** Inspector PIN regenerated */
  PIN_REGENERATED = 'PIN_REGENERATED',
}

/**
 * Severity levels for security events.
 */
export enum SecurityEventSeverity {
  /** Routine operations (successful logins, token refresh) */
  INFO = 'INFO',
  /** Potential abuse: failed logins, inactive account attempts */
  WARNING = 'WARNING',
  /** High-impact events: role changes, mass session revocation */
  CRITICAL = 'CRITICAL',
}
