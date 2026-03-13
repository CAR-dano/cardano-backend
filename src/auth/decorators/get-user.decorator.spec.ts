/*
 * --------------------------------------------------------------------------
 * File: get-user.decorator.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the GetUser custom parameter decorator.
 * --------------------------------------------------------------------------
 */

import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { GetUser } from './get-user.decorator';
import { Role } from '@prisma/client';

/**
 * Helper to extract the factory function from a createParamDecorator result.
 * Applies the decorator to a dummy controller method and reads the factory
 * stored in ROUTE_ARGS_METADATA on the constructor.
 */
function extractDecoratorFactory(): (data: any, ctx: ExecutionContext) => any {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    testMethod(_user: any) {}
  }

  // Apply the decorator to parameter 0 of 'testMethod'
  const paramDecorator = GetUser();
  paramDecorator(TestController.prototype, 'testMethod', 0);

  // NestJS stores ROUTE_ARGS_METADATA on the constructor (not the prototype)
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'testMethod',
  );

  const key = Object.keys(args)[0];
  return args[key].factory;
}

describe('GetUser Decorator', () => {
  const mockUser = {
    id: 'user-id-123',
    email: 'test@example.com',
    name: 'Test User',
    role: Role.INSPECTOR,
    createdAt: new Date(),
    updatedAt: new Date(),
    walletAddress: null,
    refreshToken: null,
    isActive: true,
  };

  let factory: (data: any, ctx: ExecutionContext) => any;

  beforeEach(() => {
    factory = extractDecoratorFactory();
  });

  const createMockContext = (user: any): ExecutionContext => {
    const mockRequest = { user };
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;
  };

  describe('without data parameter', () => {
    it('should return the full user object when no data is provided', () => {
      // Arrange
      const ctx = createMockContext(mockUser);

      // Act
      const result = factory(undefined, ctx);

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('should return undefined when user is not present on request', () => {
      // Arrange
      const ctx = createMockContext(undefined);

      // Act
      const result = factory(undefined, ctx);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('with data parameter', () => {
    it('should return the specific user property when data key is provided', () => {
      // Arrange
      const ctx = createMockContext(mockUser);

      // Act
      const result = factory('id', ctx);

      // Assert
      expect(result).toBe('user-id-123');
    });

    it('should return email when data is "email"', () => {
      // Arrange
      const ctx = createMockContext(mockUser);

      // Act
      const result = factory('email', ctx);

      // Assert
      expect(result).toBe('test@example.com');
    });

    it('should return role when data is "role"', () => {
      // Arrange
      const ctx = createMockContext(mockUser);

      // Act
      const result = factory('role', ctx);

      // Assert
      expect(result).toBe(Role.INSPECTOR);
    });

    it('should return undefined for a valid key when user is not set', () => {
      // Arrange
      const ctx = createMockContext(undefined);

      // Act
      const result = factory('id', ctx);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
