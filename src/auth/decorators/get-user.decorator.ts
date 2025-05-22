/*
 * --------------------------------------------------------------------------
 * File: get-user.decorator.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Custom route parameter decorator (@GetUser) to easily extract
 * the authenticated user object (or a specific property of it) from the request object.
 * Assumes an authentication guard (like JwtAuthGuard) has already populated `request.user`.
 * --------------------------------------------------------------------------
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

// Define the type for the user object attached to the request
// Omit sensitive fields matching the return type of JwtStrategy.validate
type AuthenticatedUser = Omit<User, 'password' | 'googleId'>;

/**
 * `@GetUser()` parameter decorator.
 * Extracts the `user` object attached to the `request` by an authentication guard.
 *
 * @param {keyof AuthenticatedUser} data - Optional property key to extract from the user object.
 * @param {ExecutionContext} ctx - The execution context.
 * @returns {AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser]} The full user object or the specified property.
 *
 * @example
 * // Get the whole user object:
 * async myHandler(@GetUser() user: AuthenticatedUser) { ... }
 *
 * @example
 * // Get a specific property (e.g., 'sub' or 'id'):
 * async myHandler(@GetUser('id') userId: string) { ... }
 *
 * @example
 * // Get the role:
 * async myHandler(@GetUser('role') userRole: Role) { ... }
 */
export const GetUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (data) {
      return user?.[data];
    }
    return user;
  },
);
