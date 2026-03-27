/*
 * --------------------------------------------------------------------------
 * File: jwt-auth.guard.spec.ts
 * --------------------------------------------------------------------------
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenBlacklistedException } from '../exceptions/token-blacklisted.exception';

function buildContext(
  method = 'GET',
  url = '/api/test',
  originalUrl = '/api/test',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, url, originalUrl }),
    }),
    getType: () => 'http',
    getArgByIndex: jest.fn(),
    getArgs: jest.fn(),
    getClass: jest.fn(),
    getHandler: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  describe('canActivate', () => {
    it('should call super.canActivate and delegate to passport jwt strategy', () => {
      const mockRequest = { method: 'GET', url: '/api/protected' };
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const superCanActivate = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(superCanActivate).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);

      superCanActivate.mockRestore();
    });
  });

  describe('handleRequest', () => {
    const ctx = buildContext();

    it('should return user when everything is valid', () => {
      const user = { id: '1', role: 'ADMIN' };
      const result = guard.handleRequest(null, user, null as any, ctx);
      expect(result).toBe(user);
    });

    it('should throw TokenBlacklistedException when err is TokenBlacklistedException', () => {
      const err = new TokenBlacklistedException('token blacklisted');
      expect(() => guard.handleRequest(err, null, null as any, ctx)).toThrow(
        TokenBlacklistedException,
      );
    });

    it('should throw UnauthorizedException with "Token has expired" for TokenExpiredError info', () => {
      const info = new TokenExpiredError('jwt expired', new Date());
      expect(() => guard.handleRequest(null, null, info, ctx)).toThrow(
        /Token has expired/,
      );
    });

    it('should throw UnauthorizedException with "Invalid token" for JsonWebTokenError info', () => {
      const info = new JsonWebTokenError('invalid signature');
      expect(() => guard.handleRequest(null, null, info, ctx)).toThrow(
        /Invalid token/,
      );
    });

    it('should re-throw err when a generic error is passed', () => {
      const err = new Error('some auth error');
      expect(() => guard.handleRequest(err, null, null as any, ctx)).toThrow(
        'some auth error',
      );
    });

    it('should throw UnauthorizedException when user is null with no other error', () => {
      expect(() => guard.handleRequest(null, null, null as any, ctx)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException with message "Unauthorized access" when no user', () => {
      expect(() => guard.handleRequest(null, null, null as any, ctx)).toThrow(
        /Unauthorized access/,
      );
    });
  });
});
