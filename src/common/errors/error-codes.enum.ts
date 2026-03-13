/*
 * --------------------------------------------------------------------------
 * File: error-codes.enum.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Centralized error codes for consistent error identification
 * across the entire application. Grouped by domain for easy navigation.
 * --------------------------------------------------------------------------
 */

export enum ErrorCode {
  // ── General / Validation (GEN-xxx) ──────────────────────────────
  VALIDATION_ERROR = 'GEN-001',
  INTERNAL_ERROR = 'GEN-002',
  NOT_FOUND = 'GEN-003',
  FORBIDDEN = 'GEN-004',
  CONFLICT = 'GEN-005',
  BAD_REQUEST = 'GEN-006',
  TOO_MANY_REQUESTS = 'GEN-007',

  // ── Auth (AUTH-xxx) ─────────────────────────────────────────────
  UNAUTHORIZED = 'AUTH-001',
  INVALID_CREDENTIALS = 'AUTH-002',
  TOKEN_EXPIRED = 'AUTH-003',
  TOKEN_BLACKLISTED = 'AUTH-004',
  REFRESH_TOKEN_INVALID = 'AUTH-005',

  // ── User (USR-xxx) ─────────────────────────────────────────────
  USER_NOT_FOUND = 'USR-001',
  USER_EMAIL_CONFLICT = 'USR-002',
  USER_USERNAME_CONFLICT = 'USR-003',
  USER_WALLET_CONFLICT = 'USR-004',
  USER_UNIQUE_CONFLICT = 'USR-005',
  USER_ROLE_SELF_CHANGE = 'USR-006',
  USER_SUPER_ADMIN_PROTECTED = 'USR-007',
  USER_CREATE_FAILED = 'USR-008',
  USER_UPDATE_FAILED = 'USR-009',
  USER_DELETE_FAILED = 'USR-010',
  USER_PASSWORD_HASH_FAILED = 'USR-011',
  USER_PIN_HASH_FAILED = 'USR-012',

  // ── Inspection (INS-xxx) ────────────────────────────────────────
  INSPECTION_NOT_FOUND = 'INS-001',
  INSPECTION_ALREADY_APPROVED = 'INS-002',
  INSPECTION_INVALID_DATE = 'INS-003',
  INSPECTION_FORBIDDEN = 'INS-004',
  INSPECTION_CONFLICT = 'INS-005',
  INSPECTION_UPDATE_FAILED = 'INS-006',
  INSPECTION_CREATE_FAILED = 'INS-007',
  INSPECTION_PAGINATION_ERROR = 'INS-008',

  // ── Photo (PHO-xxx) ────────────────────────────────────────────
  PHOTO_NOT_FOUND = 'PHO-001',
  PHOTO_INVALID_FILE = 'PHO-002',
  PHOTO_UPLOAD_FAILED = 'PHO-003',
  PHOTO_DELETE_FAILED = 'PHO-004',

  // ── Blockchain (BLK-xxx) ────────────────────────────────────────
  BLOCKCHAIN_TX_HASH_REQUIRED = 'BLK-001',
  BLOCKCHAIN_ASSET_ID_REQUIRED = 'BLK-002',
  BLOCKCHAIN_ASSET_NOT_FOUND = 'BLK-003',
  BLOCKCHAIN_TX_NOT_FOUND = 'BLK-004',
  BLOCKCHAIN_NO_UTXOS = 'BLK-005',
  BLOCKCHAIN_MINTING_FAILED = 'BLK-006',
  BLOCKCHAIN_API_ERROR = 'BLK-007',
  BLOCKCHAIN_METADATA_INVALID = 'BLK-008',
  WALLET_SIGNATURE_INVALID = 'BLK-009',

  // ── PDF (PDF-xxx) ──────────────────────────────────────────────
  PDF_GENERATION_FAILED = 'PDF-001',

  // ── Database (DB-xxx) ──────────────────────────────────────────
  DATABASE_ERROR = 'DB-001',
  DATABASE_QUERY_TIMEOUT = 'DB-002',
  DATABASE_CONNECTION_FAILED = 'DB-003',

  // ── Dashboard (DSH-xxx) ────────────────────────────────────────
  DASHBOARD_INVALID_DATE_RANGE = 'DSH-001',
  DASHBOARD_MISSING_DATES = 'DSH-002',

  // ── IPFS (IPFS-xxx) ────────────────────────────────────────────
  IPFS_CONFIG_MISSING = 'IPFS-001',
  IPFS_UPLOAD_FAILED = 'IPFS-002',

  // ── Branch (BRN-xxx) ──────────────────────────────────────────
  BRANCH_NOT_FOUND = 'BRN-001',

  // ── Change Log (CLG-xxx) ──────────────────────────────────────
  CHANGELOG_NOT_FOUND = 'CLG-001',
  CHANGELOG_INSPECTION_NOT_FOUND = 'CLG-002',
}
