// src/auth/guards/roles.guard.ts
/**
 * @fileoverview Authorization guard implementing role-based access control (RBAC).
 * Retrieves allowed roles from metadata set by the @Roles decorator and checks
 * against the role attached to the authenticated user (req.user).
 * Must be used AFTER an authentication guard like JwtAuthGuard.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core'; // Helper to read metadata
import { Role } from '@prisma/client'; // User Role enum
import { ROLES_KEY } from '../decorators/roles.decorator'; // Key to access metadata

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  // Inject Reflector to access decorator metadata
  constructor(private reflector: Reflector) {}

  /**
   * Determines if the current authenticated user has one of the roles required
   * by the @Roles decorator applied to the route handler or controller.
   *
   * @param {ExecutionContext} context - Provides access to the request and handler/class metadata.
   * @returns {boolean} True if the user has permission, otherwise throws ForbiddenException.
   * @throws {ForbiddenException} If the user object or role is missing, or if the user's role is not allowed.
   */
  canActivate(context: ExecutionContext): boolean {
    // Get the roles defined by the @Roles(...) decorator on the handler/controller
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), // Check method decorator first
      context.getClass(), // Then check controller decorator
    ]);

    // If no @Roles decorator is present, access is granted by default.
    // Adjust this logic if you prefer default denial.
    if (!requiredRoles || requiredRoles.length === 0) {
      this.logger.verbose('No specific roles required, access granted.');
      return true;
    }

    // Get the user object attached by the preceding authentication guard (e.g., JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();

    // If no user object or role is found, deny access (problem with auth guard setup)
    if (!user || !user.role) {
      this.logger.warn(
        'RolesGuard: User or user.role not found on request. Denying access.',
      );
      throw new ForbiddenException(
        'User role information is missing or authentication failed.',
      );
    }

    this.logger.verbose(
      `Required roles: ${requiredRoles.join(', ')} | User role: ${user.role}`,
    );

    // Check if the user's role is included in the list of required roles
    const hasPermission = requiredRoles.some((role) => user.role === role);

    if (!hasPermission) {
      this.logger.warn(
        `Access denied for user ${user.id} (Role: ${user.role}). Required: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    // If the user's role matches one of the required roles, grant access
    this.logger.verbose(
      `Access granted for user ${user.id} (Role: ${user.role}).`,
    );
    return true;
  }
}
