/**
 * @fileoverview Integration tests for User Management (Admin) endpoints.
 * All endpoints require JwtAuthGuard + RolesGuard with ADMIN or SUPERADMIN role.
 * Covers: list users, get by ID, create inspector, create admin, update user,
 * update role, update inspector, generate pin, delete user.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import {
  getTestApp,
  closeTestApp,
  TestAppContext,
  createInspectorPayload,
  createAdminPayload,
} from './helpers';

describe('UsersController (e2e) - Admin User Management', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  const adminRoute = '/api/v1/admin/users';

  // ─── Authorization Checks ────────────────────────────────────────────────────

  describe('Authorization', () => {
    it('should return 401 if no token provided', () => {
      return request(ctx.app.getHttpServer())
        .get(adminRoute)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 if role is CUSTOMER', () => {
      return request(ctx.app.getHttpServer())
        .get(adminRoute)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 if role is INSPECTOR', () => {
      return request(ctx.app.getHttpServer())
        .get(adminRoute)
        .set('Authorization', `Bearer ${ctx.tokens.inspector.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 if role is REVIEWER', () => {
      return request(ctx.app.getHttpServer())
        .get(adminRoute)
        .set('Authorization', `Bearer ${ctx.tokens.reviewer.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── List Users ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/admin/users', () => {
    it('should return 200 with array of users for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(adminRoute)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          // Users should not expose password
          res.body.forEach((user: any) => {
            expect(user).not.toHaveProperty('password');
          });
        });
    });

    it('should return 200 for SUPERADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(adminRoute)
        .set('Authorization', `Bearer ${ctx.tokens.superadmin.accessToken}`)
        .expect(HttpStatus.OK);
    });
  });

  // ─── List Inspectors ──────────────────────────────────────────────────────────

  describe('GET /api/v1/admin/users/inspectors', () => {
    it('should return 200 with array of inspectors for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${adminRoute}/inspectors`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // All returned users should have INSPECTOR role
          res.body.forEach((user: any) => {
            expect(user.role).toBe('INSPECTOR');
          });
        });
    });
  });

  // ─── List Admins (SUPERADMIN only) ────────────────────────────────────────────

  describe('GET /api/v1/admin/users/admins', () => {
    it('should return 200 for SUPERADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${adminRoute}/admins`)
        .set('Authorization', `Bearer ${ctx.tokens.superadmin.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return 403 for ADMIN (not SUPERADMIN)', () => {
      return request(ctx.app.getHttpServer())
        .get(`${adminRoute}/admins`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── Get User by ID ──────────────────────────────────────────────────────────

  describe('GET /api/v1/admin/users/:id', () => {
    it('should return 200 with user details for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${adminRoute}/${ctx.tokens.customer.id}`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(ctx.tokens.customer.id);
          expect(res.body.role).toBe('CUSTOMER');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return 404 for non-existent user', () => {
      return request(ctx.app.getHttpServer())
        .get(`${adminRoute}/00000000-0000-4000-a000-000000000000`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for invalid UUID', () => {
      return request(ctx.app.getHttpServer())
        .get(`${adminRoute}/not-a-uuid`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ─── Create Inspector ─────────────────────────────────────────────────────────

  describe('POST /api/v1/admin/users/inspector', () => {
    it('should create inspector and return 201 with pin', async () => {
      const payload = createInspectorPayload(ctx.branchCityId);

      const res = await request(ctx.app.getHttpServer())
        .post(`${adminRoute}/inspector`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('pin');
      expect(res.body.email).toBe(payload.email);
      expect(res.body.role).toBe('INSPECTOR');
    });

    it('should return 400 with missing required fields', () => {
      return request(ctx.app.getHttpServer())
        .post(`${adminRoute}/inspector`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ email: 'incomplete@test.com' }) // missing username, name, branchCityId
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 403 for non-admin role', () => {
      return request(ctx.app.getHttpServer())
        .post(`${adminRoute}/inspector`)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .send(createInspectorPayload(ctx.branchCityId))
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── Create Admin (SUPERADMIN only) ───────────────────────────────────────────

  describe('POST /api/v1/admin/users/admin-user', () => {
    it('should create admin user and return 201 for SUPERADMIN', async () => {
      const payload = createAdminPayload();

      const res = await request(ctx.app.getHttpServer())
        .post(`${adminRoute}/admin-user`)
        .set('Authorization', `Bearer ${ctx.tokens.superadmin.accessToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe(payload.email);
      expect(res.body.role).toBe('ADMIN');
    });

    it('should return 403 for ADMIN (not SUPERADMIN)', () => {
      return request(ctx.app.getHttpServer())
        .post(`${adminRoute}/admin-user`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send(createAdminPayload())
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── Update User Role ─────────────────────────────────────────────────────────

  describe('PUT /api/v1/admin/users/:id/role', () => {
    let targetUserId: string;

    beforeAll(async () => {
      // Create a disposable user to change role
      const user = await ctx.prisma.user.create({
        data: {
          id: randomUUID(),
          email: `role_target.inttest@test.com`,
          username: `inttest_role_target`,
          name: 'Role Target',
          role: 'CUSTOMER',
        },
      });
      targetUserId = user.id;
    });

    it('should update user role for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .put(`${adminRoute}/${targetUserId}/role`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ role: 'REVIEWER' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.role).toBe('REVIEWER');
        });
    });

    it('should return 400 with invalid role enum', () => {
      return request(ctx.app.getHttpServer())
        .put(`${adminRoute}/${targetUserId}/role`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ role: 'INVALID_ROLE' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ─── Update User ──────────────────────────────────────────────────────────────

  describe('PUT /api/v1/admin/users/:id', () => {
    it('should update user name for ADMIN', async () => {
      const res = await request(ctx.app.getHttpServer())
        .put(`${adminRoute}/${ctx.tokens.customer.id}`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ name: 'Updated Customer Name' })
        .expect(HttpStatus.OK);

      expect(res.body.name).toBe('Updated Customer Name');
    });
  });

  // ─── Update Inspector ─────────────────────────────────────────────────────────

  describe('PUT /api/v1/admin/users/inspector/:id', () => {
    it('should update inspector details for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .put(`${adminRoute}/inspector/${ctx.tokens.inspector.id}`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ name: 'Updated Inspector Name' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Inspector Name');
        });
    });
  });

  // ─── Generate Inspector PIN ───────────────────────────────────────────────────

  describe('POST /api/v1/admin/users/inspector/:id/generate-pin', () => {
    it('should generate new PIN for inspector', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post(`${adminRoute}/inspector/${ctx.tokens.inspector.id}/generate-pin`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('pin');
      expect(res.body.pin).toMatch(/^\d{6}$/); // 6-digit PIN
    });

    it('should return 403 for CUSTOMER', () => {
      return request(ctx.app.getHttpServer())
        .post(`${adminRoute}/inspector/${ctx.tokens.inspector.id}/generate-pin`)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── Delete User ──────────────────────────────────────────────────────────────

  describe('DELETE /api/v1/admin/users/:id', () => {
    let deletableUserId: string;

    beforeAll(async () => {
      const user = await ctx.prisma.user.create({
        data: {
          id: randomUUID(),
          email: `deletable.inttest@test.com`,
          username: `inttest_deletable`,
          name: 'Deletable User',
          role: 'CUSTOMER',
        },
      });
      deletableUserId = user.id;
    });

    it('should delete user and return 204 for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .delete(`${adminRoute}/${deletableUserId}`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should return 404 when trying to delete already-deleted user', () => {
      return request(ctx.app.getHttpServer())
        .delete(`${adminRoute}/${deletableUserId}`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 403 for CUSTOMER', () => {
      return request(ctx.app.getHttpServer())
        .delete(`${adminRoute}/${ctx.tokens.customer.id}`)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
