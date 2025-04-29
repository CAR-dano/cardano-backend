/**
 * @fileoverview Custom decorator (@Roles) to assign role-based metadata to route handlers.
 * This metadata is used by the RolesGuard to determine if a user with a specific role
 * has permission to access the endpoint.
 */

import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client'; // Import your Role enum

/**
 * Key used to store and retrieve role metadata.
 * It's good practice to use a constant for the key.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator function `@Roles(...roles)`
 * Attaches an array of allowed roles to the target method or controller.
 *
 * @param {...Role[]} roles - An array of Role enum values that are allowed to access the decorated route.
 * @example @Roles(Role.ADMIN, Role.EDITOR)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);