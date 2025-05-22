/*
 * --------------------------------------------------------------------------
 * File: jwt-payload.interface.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Defines the structure of the data embedded within the JWT access token.
 * This interface is used by the JwtStrategy to type the validated payload
 * and by the AuthService when signing the token.
 * --------------------------------------------------------------------------
 */

import { Role } from '@prisma/client';

export interface JwtPayload {
  /**
   * User ID (Subject of the token). Standard JWT claim 'sub'.
   */
  sub: string;

  /**
   * User's role, determining authorization level. Uses the Role enum. Required.
   */
  role: Role;

  /**
   * User's email address (optional in payload, might be null/undefined).
   */
  email?: string;

  /**
   * User's username (optional in payload, might be null/undefined).
   */
  username?: string;

  /**
   * User's display name (optional in payload, might be null/undefined).
   */
  name?: string;

  // Add other relevant, non-sensitive claims here if necessary (e.g., provider type?).
}
