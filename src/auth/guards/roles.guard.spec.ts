/*
 * --------------------------------------------------------------------------
 * File: roles.guard.spec.ts
 * --------------------------------------------------------------------------
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function buildContext(user: any, handler: any = {}, klass: any = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when no required roles are defined', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildContext({ role: Role.ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should return true when required roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const ctx = buildContext({ role: Role.ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when no user on request', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has no role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ id: '1' }); // no role property
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should return true when user role matches required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ id: '1', role: Role.ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should return true when user role matches one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.SUPERADMIN]);
    const ctx = buildContext({ id: '1', role: Role.SUPERADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user role does not match required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ id: '1', role: Role.INSPECTOR });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should verify reflector is called with ROLES_KEY and handler/class', () => {
    const handler = {};
    const klass = {};
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = buildContext({ id: '1', role: Role.ADMIN }, handler, klass);
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [handler, klass]);
  });
});
