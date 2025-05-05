/**
 * @fileoverview Guard that implements role-based access control (RBAC).
 * It retrieves the roles allowed for a specific route (set via the @Roles decorator)
 * and compares them against the role(s) attached to the authenticated user object (`request.user`).
 * It should be used *after* an authentication guard (like JwtAuthGuard) that attaches
 * the user object to the request.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client'; // Import your Role enum
import { ROLES_KEY } from '../decorators/roles.decorator'; // Import the metadata key

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  /**
   * Injects the Reflector helper class to read metadata set by decorators.
   * @param {Reflector} reflector - NestJS Reflector instance.
   */
  constructor(private reflector: Reflector) {}

  /**
   * Determines if the current user has the required role(s) to access the route.
   * Retrieves allowed roles from metadata and checks if the user's role matches.
   *
   * @param {ExecutionContext} context - The execution context providing access to request details.
   * @returns {boolean} True if the user has an allowed role, otherwise throws ForbiddenException.
   * @throws {ForbiddenException} If the user does not have the required role.
   */
  canActivate(context: ExecutionContext): boolean {
    // 1. Get the required roles metadata from the @Roles() decorator
    // reflector.getAllAndOverride combines metadata from handler and controller level
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), // Method level decorator
      context.getClass(), // Controller level decorator
    ]);

    // 2. If no @Roles() decorator is applied, allow access (guard passes)
    //    Alternatively, you might want to deny access by default if no roles are specified.
    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.verbose(
        'No specific roles required for this route. Allowing access.',
      );
      return true;
    }

    // 3. Get the user object from the request (attached by the preceding AuthGuard)
    const { user } = context.switchToHttp().getRequest();

    // 4. Check if user object exists and has a role property
    if (!user || !user.role) {
      this.logger.warn(
        'RolesGuard activated but user or user.role is missing from request. Denying access.',
      );
      // This usually indicates an issue with the preceding AuthGuard not attaching the user correctly.
      throw new ForbiddenException('User role information is missing.');
    }

    this.logger.verbose(
      `Required roles: ${requiredRoles.join(', ')}. User role: ${user.role}`,
    );

    // 5. Check if the user's role is included in the required roles array
    const hasPermission = requiredRoles.some((role) => user.role === role);

    if (!hasPermission) {
      this.logger.warn(
        `User role '${user.role}' does not have permission for roles: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    this.logger.verbose(
      `User role '${user.role}' has permission. Allowing access.`,
    );
    return true; // User has one of the required roles
  }
}
