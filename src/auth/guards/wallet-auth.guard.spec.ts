/*
 * --------------------------------------------------------------------------
 * File: wallet-auth.guard.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for WalletAuthGuard
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { WalletAuthGuard } from './wallet-auth.guard';
import { AuthGuard } from '@nestjs/passport';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('WalletAuthGuard', () => {
  let guard: WalletAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletAuthGuard],
    })
      .overrideGuard(AuthGuard('wallet'))
      .useValue({ canActivate: () => true })
      .compile();

    guard = module.get<WalletAuthGuard>(WalletAuthGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should call super.canActivate with the context', () => {
    const mockRequest = { method: 'POST', url: '/auth/wallet-login' };
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;

    // Spy on super.canActivate (AuthGuard base)
    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(WalletAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(mockContext);

    expect(superCanActivate).toHaveBeenCalledWith(mockContext);
    expect(result).toBe(true);

    superCanActivate.mockRestore();
  });

  it('should call switchToHttp().getRequest() on the context', () => {
    const mockRequest = { method: 'GET', url: '/auth/wallet' };
    const getRequest = jest.fn().mockReturnValue(mockRequest);
    const switchToHttp = jest.fn().mockReturnValue({ getRequest });
    const mockContext = { switchToHttp } as unknown as ExecutionContext;

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(WalletAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    void guard.canActivate(mockContext);

    expect(switchToHttp).toHaveBeenCalled();
    expect(getRequest).toHaveBeenCalled();

    superCanActivate.mockRestore();
  });
});
