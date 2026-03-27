/**
 * @fileoverview Integration tests for Authentication endpoints.
 * Covers: registration, login (email/username), login/inspector, refresh token,
 * profile access, check-token, logout, logout-all, and wallet login (CIP-0030).
 *
 * NOTE: Google OAuth flow is not testable in integration tests (requires browser redirect).
 * NOTE: @meshsdk/core-cst checkSignature is mocked here so tests are not dependent
 *       on real Cardano wallet CBOR hex values.
 */

// Mock @meshsdk/core-cst at the top so that when WalletStrategy/AuthService import
// checkSignature, they get the jest mock instead of the real library.
jest.mock('@meshsdk/core-cst', () => ({
  checkSignature: jest.fn(),
}));

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { checkSignature } from '@meshsdk/core-cst';
import { randomUUID } from 'crypto';
import {
  getTestApp,
  closeTestApp,
  TestAppContext,
  createRegisterPayload,
  E2E_SUFFIX,
} from './helpers';

describe('AuthController (e2e) - Integration Tests', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Register ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return user data', async () => {
      const payload = createRegisterPayload();

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      // Server normalizes email: strips dots from local part, lowercases
      const [local, domain] = payload.email.toLowerCase().split('@');
      const expectedEmail = `${local.split('+')[0].replace(/\./g, '')}@${domain}`;
      expect(res.body.email).toBe(expectedEmail);
      expect(res.body.username).toBe(payload.username);
      expect(res.body.role).toBe('CUSTOMER'); // default role
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('googleId');
    });

    it('should return 400 if email is missing', () => {
      const payload = createRegisterPayload();
      delete (payload as any).email;

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 if password is too short (less than 12 chars)', () => {
      const payload = createRegisterPayload({ password: 'short' });

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 if password lacks complexity (no special char)', () => {
      const payload = createRegisterPayload({ password: 'Passw0rdAbcdEfgh' }); // no special char
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 if password lacks complexity (no uppercase)', () => {
      const payload = createRegisterPayload({ password: 'p@ssw0rd!abcdef' }); // no uppercase
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 if username has invalid characters', () => {
      const payload = createRegisterPayload({ username: 'invalid user!@#' });

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 409 if email already exists', async () => {
      const payload = createRegisterPayload();

      // First registration
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CREATED);

      // Duplicate — server normalizes email (strips dots), so same normalized email = conflict
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CONFLICT);
    });

    it('should reject unknown/extra fields (forbidNonWhitelisted)', () => {
      const payload = createRegisterPayload({ unknownField: 'hacker' });

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ─── Login (email/username + password) ────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    let registeredEmail: string;
    const registeredPassword = 'TestPass123!';

    beforeAll(async () => {
      const payload = createRegisterPayload({ password: registeredPassword });
      registeredEmail = payload.email;

      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CREATED);
    });

    it('should return tokens and user data with valid credentials', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          loginIdentifier: registeredEmail,
          password: registeredPassword,
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      // Server normalizes email (strips dots from local part)
      const [local, domain] = registeredEmail.toLowerCase().split('@');
      const normalizedEmail = `${local.split('+')[0].replace(/\./g, '')}@${domain}`;
      expect(res.body.user.email).toBe(normalizedEmail);
    });

    it('should return 401 with wrong password', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          loginIdentifier: registeredEmail,
          password: 'WrongPassword123!',
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 with non-existent user', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          loginIdentifier: 'nobody@nowhere.com',
          password: 'doesntmatter',
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Login Inspector (PIN-based) ──────────────────────────────────────────────

  describe('POST /api/v1/auth/login/inspector', () => {
    it('should return 401 with invalid pin/email', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/inspector')
        .send({ pin: '000000', email: 'nobody@nowhere.com' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 with invalid pin format (not 6 digits)', () => {
      // InspectorGuard processes directly — no DTO validation, bcrypt.compare fails
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/inspector')
        .send({ pin: 'abc', email: 'test@test.com' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Refresh Token ────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 401 without a refresh token', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 with an invalid refresh token', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid-refresh-token')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Profile ──────────────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/profile', () => {
    it('should return 200 with user profile for admin', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(ctx.tokens.admin.id);
          expect(res.body.role).toBe('ADMIN');
          expect(res.body).not.toHaveProperty('password');
          expect(res.body).not.toHaveProperty('googleId');
        });
    });

    it('should return 200 with user profile for customer', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(ctx.tokens.customer.id);
          expect(res.body.role).toBe('CUSTOMER');
        });
    });

    it('should return 401 without token', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 with invalid token', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Check Token ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/check-token', () => {
    it('should return 200 with valid token', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/auth/check-token')
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should return 401 without token', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/auth/check-token')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    let logoutToken: string;

    beforeAll(async () => {
      // Create a disposable user for logout testing to avoid invalidating shared tokens
      const payload = createRegisterPayload();
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CREATED);

      // Login to get a token
      const [local, domain] = payload.email.toLowerCase().split('@');
      const normalizedEmail = `${local.split('+')[0].replace(/\./g, '')}@${domain}`;
      const loginRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ loginIdentifier: normalizedEmail, password: payload.password })
        .expect(HttpStatus.OK);
      logoutToken = loginRes.body.accessToken;
    });

    it('should return 200 with valid token', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${logoutToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.message).toContain('Logout successful');
        });
    });

    it('should return 401 without token', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Logout All ───────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout-all', () => {
    let logoutAllToken: string;

    beforeAll(async () => {
      // Create a disposable user for logout-all testing
      const payload = createRegisterPayload();
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(payload)
        .expect(HttpStatus.CREATED);

      const [local, domain] = payload.email.toLowerCase().split('@');
      const normalizedEmail = `${local.split('+')[0].replace(/\./g, '')}@${domain}`;
      const loginRes = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ loginIdentifier: normalizedEmail, password: payload.password })
        .expect(HttpStatus.OK);
      logoutAllToken = loginRes.body.accessToken;
    });

    it('should return 200 with valid token', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${logoutAllToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should return 401 without token', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/logout-all')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Wallet Login (CIP-0030) ──────────────────────────────────────────────────
  //
  // @meshsdk/core-cst's checkSignature is mocked at the top of this file.
  // This lets us test the full HTTP layer, DTO validation, guard, and DB lookup
  // without requiring real Cardano wallet CBOR hex values.

  describe('POST /api/v1/auth/login/wallet', () => {
    const checkSignatureMock = checkSignature as jest.Mock;

    /** Bech32 wallet address used for all wallet login tests */
    const WALLET_ADDRESS =
      'addr1qx2k8walletintegrationtest000000000000000000000000000';

    /** A timestamp that is 1 minute in the future — always within the 5-minute window */
    const freshTimestamp = () => new Date(Date.now() + 60_000).toISOString();

    /** A valid CIP-0030 DataSignature JSON string */
    const validSignatureJson = JSON.stringify({
      signature: 'cbor-sig-hex-mock',
      key: 'cbor-key-hex-mock',
    });

    /** Creates a wallet user directly in the database */
    async function createWalletUser() {
      return ctx.prisma.user.create({
        data: {
          id: randomUUID(),
          email: `walletuser${Date.now()}${E2E_SUFFIX}`,
          username: `inttest_wallet_${Date.now()}`,
          name: 'IntTest Wallet User',
          role: 'CUSTOMER',
          isActive: true,
          walletAddress: WALLET_ADDRESS,
        },
      });
    }

    beforeEach(() => {
      checkSignatureMock.mockReset();
    });

    // ── 400 Bad Request cases (DTO validation) ─────────────────────────────────

    it('should return 400 when walletAddress is missing', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          payload: `Login at ${freshTimestamp()}`,
          signature: validSignatureJson,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when payload is missing', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          signature: validSignatureJson,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when signature is missing', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: `Login at ${freshTimestamp()}`,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when walletAddress is not a valid Cardano bech32 format', () => {
      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: 'not-a-valid-cardano-address',
          payload: `Login at ${freshTimestamp()}`,
          signature: validSignatureJson,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when signature is not valid JSON (caught by WalletStrategy)', () => {
      // checkSignature won't even be called since JSON.parse fails first
      checkSignatureMock.mockResolvedValue(false);

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: `Login at ${freshTimestamp()}`,
          signature: 'this-is-not-json',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 when signature JSON is missing required fields', () => {
      checkSignatureMock.mockResolvedValue(false);

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: `Login at ${freshTimestamp()}`,
          signature: JSON.stringify({ signature: 'sig-only' }), // missing 'key'
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    // ── 401 Unauthorized cases ─────────────────────────────────────────────────

    it('should return 401 when signature verification fails', () => {
      checkSignatureMock.mockResolvedValue(false);

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: `Login at ${freshTimestamp()}`,
          signature: validSignatureJson,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when payload timestamp is older than 5 minutes', () => {
      checkSignatureMock.mockResolvedValue(true);
      const staleTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString();

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: `Login to CAR-dano at ${staleTimestamp}`,
          signature: validSignatureJson,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when payload has no ISO timestamp', () => {
      checkSignatureMock.mockResolvedValue(true);

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: 'Login to CAR-dano with no timestamp here',
          signature: validSignatureJson,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 401 when user is not found by wallet address', () => {
      checkSignatureMock.mockResolvedValue(true);

      return request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: `Login to CAR-dano at ${freshTimestamp()}`,
          signature: validSignatureJson,
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    // ── 200 Success ────────────────────────────────────────────────────────────

    it('should return 200 with tokens and user data when signature is valid and user exists', async () => {
      const walletUser = await createWalletUser();
      checkSignatureMock.mockResolvedValue(true);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login/wallet')
        .send({
          walletAddress: WALLET_ADDRESS,
          payload: `Login to CAR-dano: ${WALLET_ADDRESS} at ${freshTimestamp()}`,
          signature: validSignatureJson,
        })
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.id).toBe(walletUser.id);
      expect(res.body.user.walletAddress).toBe(WALLET_ADDRESS);
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('googleId');

      // Clean up the wallet user
      await ctx.prisma.user.delete({ where: { id: walletUser.id } });
    });
  });
});
