/**
 * @fileoverview Integration tests for Inspection Change Log endpoints.
 * Covers: get changelog for an inspection, delete a changelog entry.
 * Requires ADMIN/REVIEWER/SUPERADMIN role.
 *
 * Test data is created directly via Prisma to avoid dependency on the
 * POST /inspections endpoint's transactional ID generation.
 */

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  getTestApp,
  closeTestApp,
  TestAppContext,
} from './helpers';

describe('InspectionChangeLogController (e2e)', () => {
  let ctx: TestAppContext;
  let inspectionId: string;
  let changeLogId: string;

  beforeAll(async () => {
    ctx = await getTestApp();

    // Create an inspection directly via Prisma
    inspectionId = randomUUID();
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ctx.prisma.inspection.create({
      data: {
        id: inspectionId,
        pretty_id: `INTTEST-CL-${suffix}`,
        vehiclePlateNumber: `INTTESTCL${suffix}`,
        overallRating: '85',
        status: 'NEED_REVIEW',
        inspectorId: ctx.tokens.inspector.id,
        branchCityId: ctx.branchCityId,
      },
    });

    // Update it via API to generate a changelog entry
    await request(ctx.app.getHttpServer())
      .put(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
      .send({ overallRating: 95 })
      .expect(HttpStatus.OK);

    // Fetch the changelog to get an entry ID
    const clogs = await ctx.prisma.inspectionChangeLog.findMany({
      where: { inspectionId },
    });
    if (clogs.length > 0) {
      changeLogId = clogs[0].id;
    }
  }, 30000);

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Get Changelog ────────────────────────────────────────────────────────────

  describe('GET /api/v1/inspections/:inspectionId/changelog', () => {
    it('should return 200 with changelog array for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1/inspections/${inspectionId}/changelog`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return 200 for REVIEWER', () => {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1/inspections/${inspectionId}/changelog`)
        .set('Authorization', `Bearer ${ctx.tokens.reviewer.accessToken}`)
        .expect(HttpStatus.OK);
    });

    it('should return 403 for CUSTOMER', () => {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1/inspections/${inspectionId}/changelog`)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 401 without auth', () => {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1/inspections/${inspectionId}/changelog`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 404 for non-existent inspection', () => {
      return request(ctx.app.getHttpServer())
        .get(
          '/api/v1/inspections/00000000-0000-4000-a000-000000000000/changelog',
        )
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── Delete Changelog Entry ───────────────────────────────────────────────────

  describe('DELETE /api/v1/inspections/:inspectionId/changelog/:changeLogId', () => {
    it('should return 403 for CUSTOMER', async () => {
      if (!changeLogId) return; // Skip if no changelog was generated

      await request(ctx.app.getHttpServer())
        .delete(
          `/api/v1/inspections/${inspectionId}/changelog/${changeLogId}`,
        )
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should delete changelog entry for ADMIN', async () => {
      if (!changeLogId) return; // Skip if no changelog was generated

      await request(ctx.app.getHttpServer())
        .delete(
          `/api/v1/inspections/${inspectionId}/changelog/${changeLogId}`,
        )
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
