import { Test, TestingModule } from '@nestjs/testing';
import { SecurityLoggerService } from './security-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecurityEventType,
  SecurityEventSeverity,
} from './security-event.enum';
import { SecurityEvent } from './security-event.interface';

const mockPrismaService = {
  securityLog: {
    create: jest.fn(),
  },
};

describe('SecurityLoggerService', () => {
  let service: SecurityLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityLoggerService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SecurityLoggerService>(SecurityLoggerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // log()
  // ---------------------------------------------------------------------------
  describe('log()', () => {
    it('should call prisma.securityLog.create with correct data for an INFO event', async () => {
      mockPrismaService.securityLog.create.mockResolvedValue({});

      const event: SecurityEvent = {
        type: SecurityEventType.LOGIN_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        userId: 'user-123',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        details: { loginIdentifier: 'test@example.com' },
      };

      await service.log(event);

      expect(mockPrismaService.securityLog.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.securityLog.create).toHaveBeenCalledWith({
        data: {
          type: SecurityEventType.LOGIN_SUCCESS,
          severity: SecurityEventSeverity.INFO,
          userId: 'user-123',
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          details: { loginIdentifier: 'test@example.com' },
        },
      });
    });

    it('should call prisma.securityLog.create for a WARNING event', async () => {
      mockPrismaService.securityLog.create.mockResolvedValue({});

      const event: SecurityEvent = {
        type: SecurityEventType.LOGIN_FAILURE_BAD_PASSWORD,
        severity: SecurityEventSeverity.WARNING,
        userId: 'user-456',
        ip: '10.0.0.1',
      };

      await service.log(event);

      expect(mockPrismaService.securityLog.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrismaService.securityLog.create.mock.calls[0][0];
      expect(createCall.data.type).toBe(
        SecurityEventType.LOGIN_FAILURE_BAD_PASSWORD,
      );
      expect(createCall.data.severity).toBe(SecurityEventSeverity.WARNING);
      expect(createCall.data.userId).toBe('user-456');
    });

    it('should call prisma.securityLog.create for a CRITICAL event', async () => {
      mockPrismaService.securityLog.create.mockResolvedValue({});

      const event: SecurityEvent = {
        type: SecurityEventType.ROLE_CHANGED,
        severity: SecurityEventSeverity.CRITICAL,
        userId: 'user-789',
        details: { oldRole: 'CUSTOMER', newRole: 'ADMIN' },
      };

      await service.log(event);

      expect(mockPrismaService.securityLog.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrismaService.securityLog.create.mock.calls[0][0];
      expect(createCall.data.severity).toBe(SecurityEventSeverity.CRITICAL);
    });

    it('should persist null for optional fields when not provided', async () => {
      mockPrismaService.securityLog.create.mockResolvedValue({});

      const event: SecurityEvent = {
        type: SecurityEventType.LOGIN_FAILURE_USER_NOT_FOUND,
        severity: SecurityEventSeverity.WARNING,
        // userId, ip, userAgent, details deliberately omitted
      };

      await service.log(event);

      const createCall = mockPrismaService.securityLog.create.mock.calls[0][0];
      expect(createCall.data.userId).toBeNull();
      expect(createCall.data.ip).toBeNull();
      expect(createCall.data.userAgent).toBeNull();
    });

    it('should NOT throw when prisma.securityLog.create fails (fire-and-forget)', async () => {
      mockPrismaService.securityLog.create.mockRejectedValue(
        new Error('DB connection lost'),
      );

      const event: SecurityEvent = {
        type: SecurityEventType.LOGIN_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        userId: 'user-123',
      };

      // The DB failure must not propagate to the caller
      await expect(service.log(event)).resolves.toBeUndefined();
    });

    it('should still resolve even when DB write fails', async () => {
      mockPrismaService.securityLog.create.mockRejectedValue(
        new Error('Timeout'),
      );

      const event: SecurityEvent = {
        type: SecurityEventType.LOGOUT_ALL_SESSIONS,
        severity: SecurityEventSeverity.CRITICAL,
        userId: 'user-999',
      };

      // Must not throw — caller flow must never be interrupted
      await expect(service.log(event)).resolves.not.toThrow();
    });

    it('should return void (undefined) on success', async () => {
      mockPrismaService.securityLog.create.mockResolvedValue({});

      const result = await service.log({
        type: SecurityEventType.TOKEN_ROTATED,
        severity: SecurityEventSeverity.INFO,
        userId: 'user-123',
      });

      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // extractRequestMeta()
  // ---------------------------------------------------------------------------
  describe('extractRequestMeta()', () => {
    it('should extract ip and userAgent from a standard Express request object', () => {
      const req = {
        ip: '192.168.1.100',
        headers: { 'user-agent': 'TestAgent/1.0' },
      };

      const meta = service.extractRequestMeta(req);

      expect(meta.ip).toBe('192.168.1.100');
      expect(meta.userAgent).toBe('TestAgent/1.0');
    });

    it('should fall back to socket.remoteAddress when req.ip is not set', () => {
      const req = {
        socket: { remoteAddress: '10.10.10.10' },
        headers: {},
      };

      const meta = service.extractRequestMeta(req);

      expect(meta.ip).toBe('10.10.10.10');
    });

    it('should extract ip from x-forwarded-for header when both ip and socket are absent', () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.5, 198.51.100.1',
          'user-agent': 'ProxyAgent/2.0',
        },
      };

      const meta = service.extractRequestMeta(req);

      // Should take the first IP in the chain
      expect(meta.ip).toBe('203.0.113.5');
      expect(meta.userAgent).toBe('ProxyAgent/2.0');
    });

    it('should return undefined for ip and userAgent when no relevant fields present', () => {
      const meta = service.extractRequestMeta({});

      expect(meta.ip).toBeUndefined();
      expect(meta.userAgent).toBeUndefined();
    });

    it('should prefer req.ip over socket.remoteAddress', () => {
      const req = {
        ip: '1.2.3.4',
        socket: { remoteAddress: '5.6.7.8' },
        headers: {},
      };

      const meta = service.extractRequestMeta(req);

      expect(meta.ip).toBe('1.2.3.4');
    });
  });

  // ---------------------------------------------------------------------------
  // SecurityEventType enum — sanity checks
  // ---------------------------------------------------------------------------
  describe('SecurityEventType enum', () => {
    it('should contain all expected event types', () => {
      expect(SecurityEventType.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
      expect(SecurityEventType.LOGIN_FAILURE_BAD_PASSWORD).toBe(
        'LOGIN_FAILURE_BAD_PASSWORD',
      );
      expect(SecurityEventType.LOGIN_FAILURE_USER_NOT_FOUND).toBe(
        'LOGIN_FAILURE_USER_NOT_FOUND',
      );
      expect(SecurityEventType.LOGIN_FAILURE_INACTIVE_ACCOUNT).toBe(
        'LOGIN_FAILURE_INACTIVE_ACCOUNT',
      );
      expect(SecurityEventType.INSPECTOR_LOGIN_SUCCESS).toBe(
        'INSPECTOR_LOGIN_SUCCESS',
      );
      expect(SecurityEventType.INSPECTOR_LOGIN_FAILURE).toBe(
        'INSPECTOR_LOGIN_FAILURE',
      );
      expect(SecurityEventType.GOOGLE_LOGIN_SUCCESS).toBe(
        'GOOGLE_LOGIN_SUCCESS',
      );
      expect(SecurityEventType.LOGOUT).toBe('LOGOUT');
      expect(SecurityEventType.LOGOUT_ALL_SESSIONS).toBe('LOGOUT_ALL_SESSIONS');
      expect(SecurityEventType.TOKEN_ROTATED).toBe('TOKEN_ROTATED');
      expect(SecurityEventType.TOKEN_BLACKLISTED).toBe('TOKEN_BLACKLISTED');
      expect(SecurityEventType.TOKEN_INVALIDATED_SESSION_VERSION).toBe(
        'TOKEN_INVALIDATED_SESSION_VERSION',
      );
      expect(SecurityEventType.USER_CREATED).toBe('USER_CREATED');
      expect(SecurityEventType.USER_DELETED).toBe('USER_DELETED');
      expect(SecurityEventType.ROLE_CHANGED).toBe('ROLE_CHANGED');
      expect(SecurityEventType.ACCOUNT_STATUS_CHANGED).toBe(
        'ACCOUNT_STATUS_CHANGED',
      );
      expect(SecurityEventType.PIN_REGENERATED).toBe('PIN_REGENERATED');
    });
  });

  // ---------------------------------------------------------------------------
  // SecurityEventSeverity enum — sanity checks
  // ---------------------------------------------------------------------------
  describe('SecurityEventSeverity enum', () => {
    it('should contain INFO, WARNING, and CRITICAL', () => {
      expect(SecurityEventSeverity.INFO).toBe('INFO');
      expect(SecurityEventSeverity.WARNING).toBe('WARNING');
      expect(SecurityEventSeverity.CRITICAL).toBe('CRITICAL');
    });
  });
});
