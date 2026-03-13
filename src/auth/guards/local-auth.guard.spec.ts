/*
 * --------------------------------------------------------------------------
 * File: local-auth.guard.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for LocalAuthGuard
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalAuthGuard],
    }).compile();

    guard = module.get<LocalAuthGuard>(LocalAuthGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should call super.canActivate and delegate to passport local strategy', () => {
    const mockRequest = { method: 'POST', url: '/auth/login', body: { email: 'a@b.com', password: 'secret' } };
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(LocalAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(mockContext);

    expect(superCanActivate).toHaveBeenCalledWith(mockContext);
    expect(result).toBe(true);

    superCanActivate.mockRestore();
  });

  it('should call switchToHttp().getRequest() to read request details', () => {
    const mockRequest = { method: 'POST', url: '/auth/login' };
    const getRequest = jest.fn().mockReturnValue(mockRequest);
    const switchToHttp = jest.fn().mockReturnValue({ getRequest });
    const mockContext = { switchToHttp } as unknown as ExecutionContext;

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(LocalAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    guard.canActivate(mockContext);

    expect(switchToHttp).toHaveBeenCalled();
    expect(getRequest).toHaveBeenCalled();

    superCanActivate.mockRestore();
  });

  it('should propagate the result from super.canActivate when it returns a promise', async () => {
    const mockRequest = { method: 'POST', url: '/auth/login' };
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(LocalAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(true);

    const result = await (guard.canActivate(mockContext) as Promise<boolean>);

    expect(result).toBe(true);

    superCanActivate.mockRestore();
  });
});
