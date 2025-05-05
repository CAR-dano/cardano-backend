/*
 * --------------------------------------------------------------------------
 * File: jwt-payload.interface.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Defines the structure of the data embedded within the JWT access token.
 * This interface is used by the JwtStrategy to type the validated payload
 * and by the AuthService when signing the token.
 * --------------------------------------------------------------------------
 */

import { Role } from '@prisma/client'; // Import enum Role from Prisma

export interface JwtPayload {
  /**
   * User ID (Subject of the token).
   * Standard JWT claim 'sub'.
   */
  sub: string;

  /**
   * User's email address. Included for convenience, can be used for display
   * or secondary checks if needed.
   */
  email: string;

  /**
   * User's role, determines authorization level.
   * Uses the Role enum defined in the Prisma schema.
   */
  role: Role;

  /**
   * (Optional) User's display name. Included for convenience, e.g., for display
   * in the frontend after decoding the token.
   */
  name?: string;

  // Add other relevant, non-sensitive claims here if necessary.
}
