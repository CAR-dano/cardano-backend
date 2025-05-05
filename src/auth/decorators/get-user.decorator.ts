// src/auth/decorators/get-user.decorator.ts
/**
 * @fileoverview Custom route parameter decorator (@GetUser) to easily extract
 * the authenticated user object (or a specific property of it) from the request object.
 * Assumes an authentication guard (like JwtAuthGuard) has already populated `request.user`.
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client'; // Import User type if needed for strong typing

// Define the type for the user object attached to the request
// Omit sensitive fields matching the return type of JwtStrategy.validate
type AuthenticatedUser = Omit<User, 'password' | 'googleId'>;

/**
 * `@GetUser()` parameter decorator.
 * Extracts the `user` object attached to the `request` by an authentication guard.
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
 *
 * @param {keyof AuthenticatedUser} data - Optional property key to extract from the user object.
 * @param {ExecutionContext} ctx - The execution context.
 * @returns {AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser]} The full user object or the specified property.
 */
export const GetUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    // Extract the request object from the execution context
    const request = ctx.switchToHttp().getRequest();
    // Retrieve the user object attached by the authentication guard
    const user = request.user as AuthenticatedUser; // Cast to expected type

    // If a specific property key (e.g., 'id', 'role') is provided as an argument to the decorator...
    if (data) {
      // ...return only that specific property from the user object.
      return user?.[data];
    }
    // Otherwise, return the entire user object.
    return user;
  },
);
