/*
 * --------------------------------------------------------------------------
 * File: ipfs.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for IpfsService.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { IpfsService } from './ipfs.service';
import { ConfigService } from '@nestjs/config';

// Mock ipfs-http-client before importing the service
// Note: jest.mock is hoisted, so we can't reference outer variables inside the factory.
// Instead we define the mock inside and access it via require() later.
jest.mock('ipfs-http-client', () => {
  const mockAdd = jest.fn();
  return {
    create: jest.fn().mockReturnValue({ add: mockAdd }),
    __mockAdd: mockAdd,
  };
});

const mockConfigService = {
  get: jest.fn(),
};

describe('IpfsService', () => {
  let service: IpfsService;
  let mockIpfsAdd: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Access the mock function from the hoisted mock module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mockIpfsAdd = (require('ipfs-http-client') as any).__mockAdd;

    // Default: both host and port are configured
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'IPFS_API_HOST') return 'localhost';
      if (key === 'IPFS_API_PORT') return 5001;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IpfsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<IpfsService>(IpfsService);
    service.onModuleInit(); // manually call since we compile without lifecycle hooks
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // onModuleInit
  // ---------------------------------------------------------------------------
  describe('onModuleInit', () => {
    it('should throw when IPFS_API_HOST is missing', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'IPFS_API_HOST') return undefined;
        if (key === 'IPFS_API_PORT') return 5001;
        return undefined;
      });

      expect(() => service.onModuleInit()).toThrow(
        'IPFS_API_HOST not found in configuration.',
      );
    });

    it('should throw when IPFS_API_PORT is missing', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'IPFS_API_HOST') return 'localhost';
        if (key === 'IPFS_API_PORT') return undefined;
        return undefined;
      });

      expect(() => service.onModuleInit()).toThrow(
        'IPFS_API_PORT not found in configuration.',
      );
    });

    it('should create an IPFS client with the correct URL', () => {
      const { create } = require('ipfs-http-client');

      // Reset and re-call
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'IPFS_API_HOST') return '10.0.0.1';
        if (key === 'IPFS_API_PORT') return 5001;
        return undefined;
      });
      service.onModuleInit();

      expect(create).toHaveBeenCalledWith({ url: 'http://10.0.0.1:5001' });
    });
  });

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------
  describe('add', () => {
    it('should return the CID (path) when file is added successfully', async () => {
      mockIpfsAdd.mockResolvedValue({ path: 'QmMockCid123' });

      const buffer = Buffer.from('test content');
      const result = await service.add(buffer);

      expect(mockIpfsAdd).toHaveBeenCalledWith(buffer);
      expect(result).toBe('QmMockCid123');
    });

    it('should re-throw the error when ipfs.add fails', async () => {
      const ipfsError = new Error('IPFS node unreachable');
      mockIpfsAdd.mockRejectedValue(ipfsError);

      const buffer = Buffer.from('test content');

      await expect(service.add(buffer)).rejects.toThrow('IPFS node unreachable');
    });

    it('should handle large buffers', async () => {
      const largeCid = 'QmLargeCid456';
      mockIpfsAdd.mockResolvedValue({ path: largeCid });

      const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB
      const result = await service.add(largeBuffer);

      expect(result).toBe(largeCid);
    });
  });
});
