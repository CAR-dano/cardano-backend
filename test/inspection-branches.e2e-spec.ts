/**
 * @fileoverview Integration tests for Inspection Branches endpoints.
 * Covers: list (public), get by ID, create, update, delete, toggle-active.
 * Mixed access: GET list and GET by ID are public, all others require ADMIN/SUPERADMIN.
 */

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import {
  getTestApp,
  closeTestApp,
  TestAppContext,
  createBranchPayload,
} from './helpers';

describe('InspectionBranchesController (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  const branchRoute = '/api/v1/inspection-branches';

  // ─── List Branches (Public) ───────────────────────────────────────────────────

  describe('GET /api/v1/inspection-branches', () => {
    it('should return 200 with array of branches (no auth required)', () => {
      return request(ctx.app.getHttpServer())
        .get(branchRoute)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // Our test branch should be present
          const testBranch = res.body.find(
            (b: any) => b.id === ctx.branchCityId,
          );
          expect(testBranch).toBeDefined();
          expect(testBranch.city).toContain('TestCity-IntTest');
        });
    });
  });

  // ─── Get Branch by ID ─────────────────────────────────────────────────────────

  describe('GET /api/v1/inspection-branches/:id', () => {
    it('should return 200 with branch detail (no auth required)', () => {
      return request(ctx.app.getHttpServer())
        .get(`${branchRoute}/${ctx.branchCityId}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toBe(ctx.branchCityId);
          expect(res.body).toHaveProperty('city');
          expect(res.body).toHaveProperty('code');
          expect(res.body).toHaveProperty('isActive');
        });
    });

    it('should return 404 for non-existent branch', () => {
      return request(ctx.app.getHttpServer())
        .get(`${branchRoute}/00000000-0000-4000-a000-000000000000`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for invalid UUID', () => {
      return request(ctx.app.getHttpServer())
        .get(`${branchRoute}/not-a-uuid`)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ─── Create Branch ────────────────────────────────────────────────────────────

  describe('POST /api/v1/inspection-branches', () => {
    it('should create branch and return 201 for ADMIN', async () => {
      const payload = createBranchPayload();

      const res = await request(ctx.app.getHttpServer())
        .post(branchRoute)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(res.body).toHaveProperty('id');
      expect(res.body.city).toBe(payload.city);
      // Server auto-generates code from first 3 chars of city name (uppercased)
      expect(res.body.code).toBe(payload.city.substring(0, 3).toUpperCase());
      expect(res.body.isActive).toBe(true);
    });

    it('should return 400 with missing required fields', () => {
      return request(ctx.app.getHttpServer())
        .post(branchRoute)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ city: 'Only City' }) // missing code
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 with invalid code format', () => {
      return request(ctx.app.getHttpServer())
        .post(branchRoute)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ city: 'TestCity', code: 'too-long-code!' }) // code must be 1-3 chars, A-Z0-9
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 without auth', () => {
      return request(ctx.app.getHttpServer())
        .post(branchRoute)
        .send(createBranchPayload())
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 for CUSTOMER', () => {
      return request(ctx.app.getHttpServer())
        .post(branchRoute)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .send(createBranchPayload())
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── Update Branch ────────────────────────────────────────────────────────────

  describe('PUT /api/v1/inspection-branches/:id', () => {
    let branchId: string;

    beforeAll(async () => {
      const branch = await ctx.prisma.inspectionBranchCity.create({
        data: { city: 'TestCity-IntTest-Update', code: 'UPD', isActive: true },
      });
      branchId = branch.id;
    });

    it('should update branch city name for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .put(`${branchRoute}/${branchId}`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ city: 'TestCity-IntTest-Updated' })
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.city).toBe('TestCity-IntTest-Updated');
        });
    });

    it('should return 404 for non-existent branch', () => {
      return request(ctx.app.getHttpServer())
        .put(`${branchRoute}/00000000-0000-4000-a000-000000000000`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .send({ city: 'Nowhere' })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── Toggle Active ────────────────────────────────────────────────────────────

  describe('PATCH /api/v1/inspection-branches/:id/toggle-active', () => {
    let branchId: string;

    beforeAll(async () => {
      const branch = await ctx.prisma.inspectionBranchCity.create({
        data: {
          city: 'TestCity-IntTest-Toggle',
          code: 'TGL',
          isActive: true,
        },
      });
      branchId = branch.id;
    });

    it('should toggle branch active status for ADMIN', async () => {
      // First toggle: true -> false
      const res1 = await request(ctx.app.getHttpServer())
        .patch(`${branchRoute}/${branchId}/toggle-active`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res1.body.isActive).toBe(false);

      // Second toggle: false -> true
      const res2 = await request(ctx.app.getHttpServer())
        .patch(`${branchRoute}/${branchId}/toggle-active`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK);

      expect(res2.body.isActive).toBe(true);
    });
  });

  // ─── Delete Branch ────────────────────────────────────────────────────────────

  describe('DELETE /api/v1/inspection-branches/:id', () => {
    let branchId: string;

    beforeAll(async () => {
      const branch = await ctx.prisma.inspectionBranchCity.create({
        data: {
          city: 'TestCity-IntTest-Delete',
          code: 'DEL',
          isActive: true,
        },
      });
      branchId = branch.id;
    });

    it('should delete branch for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .delete(`${branchRoute}/${branchId}`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK); // Controller returns the deleted entity
    });

    it('should return 403 for REVIEWER', () => {
      return request(ctx.app.getHttpServer())
        .delete(`${branchRoute}/${ctx.branchCityId}`)
        .set('Authorization', `Bearer ${ctx.tokens.reviewer.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
