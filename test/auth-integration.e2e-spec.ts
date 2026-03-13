/**
 * @fileoverview Integration tests for Authentication endpoints.
 * Covers: registration, login (email/username), login/inspector, refresh token,
 * profile access, check-token, logout, and logout-all.
 *
 * NOTE: Google OAuth flow is not testable in integration tests (requires browser redirect).
 */

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import {
  getTestApp,
  closeTestApp,
  TestAppContext,
  createRegisterPayload,
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

    it('should return 400 if password is too short', () => {
      const payload = createRegisterPayload({ password: 'short' });

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
});
