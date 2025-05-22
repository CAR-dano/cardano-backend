/*
 * --------------------------------------------------------------------------
 * File: roles.decorator.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Custom decorator (@Roles) to assign role-based metadata (allowed roles)
 * to route handlers or controllers for use by the RolesGuard.
 * --------------------------------------------------------------------------
 */

import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client'; // Import your Role enum

/**
 * Constant key used by Reflector to store and retrieve the roles metadata.
 */
export const ROLES_KEY = 'roles';

/**
 * `@Roles(...roles)` decorator factory function.
 * Attaches an array of allowed `Role` enum values to the target context (method or class).
 *
 * @param {...Role[]} roles - One or more Role enum values required for access.
 * @example @Roles(Role.ADMIN)
 * @example @Roles(Role.ADMIN, Role.REVIEWER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
