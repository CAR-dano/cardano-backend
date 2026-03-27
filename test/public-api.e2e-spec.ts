/**
 * @fileoverview Integration tests for Public API endpoints.
 * All endpoints are publicly accessible (no authentication required).
 * Tests cover: health check, inspectors list, latest archived, inspection detail,
 * inspection detail (no-docs), and public changelog.
 */

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { getTestApp, closeTestApp, TestAppContext } from './helpers';
import { InspectionStatus } from '@prisma/client';

describe('PublicApiController (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Health Check ────────────────────────────────────────────────────────────

  describe('GET /api/v1/public/health/db', () => {
    it('should return 200 with status ok', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/public/health/db')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
        });
    });
  });

  // ─── Inspectors List ─────────────────────────────────────────────────────────

  describe('GET /api/v1/public/users/inspectors', () => {
    it('should return 200 with an array of inspectors', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/public/users/inspectors')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // Our test inspector should be in the list
          if (res.body.length > 0) {
            const inspector = res.body.find(
              (u: any) => u.id === ctx.tokens.inspector.id,
            );
            if (inspector) {
              expect(inspector.role).toBe('INSPECTOR');
              // Should not expose sensitive fields
              expect(inspector).not.toHaveProperty('password');
              expect(inspector).not.toHaveProperty('googleId');
            }
          }
        });
    });
  });

  // ─── Latest Archived Inspections ──────────────────────────────────────────────

  describe('GET /api/v1/public/latest-archived', () => {
    it('should return 200 with an array (may be empty)', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/public/latest-archived')
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  // ─── Inspection Detail by ID ──────────────────────────────────────────────────

  describe('GET /api/v1/public/inspections/:id', () => {
    let inspectionId: string;

    beforeAll(async () => {
      // Create an inspection directly in DB for testing public access
      const inspection = await ctx.prisma.inspection.create({
        data: {
          vehiclePlateNumber: `INTTEST-PUB1`,
          inspectionDate: new Date(),
          overallRating: '80',
          status: InspectionStatus.ARCHIVED,
          identityDetails: {
            namaInspektor: ctx.tokens.inspector.id,
            namaCustomer: 'Test',
            cabangInspeksi: ctx.branchCityId,
          },
          vehicleData: { merekKendaraan: 'Toyota' },
          equipmentChecklist: {},
          inspectionSummary: {},
          detailedAssessment: {},
          bodyPaintThickness: {},
          inspectorId: ctx.tokens.inspector.id,
          branchCityId: ctx.branchCityId,
          pretty_id: `IT-PUB-${Date.now()}`,
        },
      });
      inspectionId = inspection.id;
    });

    it('should return 200 with inspection detail for a valid ID', () => {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1/public/inspections/${inspectionId}`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', inspectionId);
        });
    });

    it('should return 404 for a non-existent UUID', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/public/inspections/00000000-0000-4000-a000-000000000000')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for an invalid UUID format', () => {
      return request(ctx.app.getHttpServer())
        .get('/api/v1/public/inspections/not-a-uuid')
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  // ─── Inspection Detail No-Docs ────────────────────────────────────────────────

  describe('GET /api/v1/public/inspections/:id/no-docs', () => {
    let inspectionId: string;

    beforeAll(async () => {
      const inspection = await ctx.prisma.inspection.create({
        data: {
          vehiclePlateNumber: `INTTEST-PUB2`,
          inspectionDate: new Date(),
          overallRating: '75',
          status: InspectionStatus.ARCHIVED,
          identityDetails: {},
          vehicleData: {},
          equipmentChecklist: {},
          inspectionSummary: {},
          detailedAssessment: {},
          bodyPaintThickness: {},
          inspectorId: ctx.tokens.inspector.id,
          branchCityId: ctx.branchCityId,
          pretty_id: `IT-PND-${Date.now()}`,
        },
      });
      inspectionId = inspection.id;
    });

    it('should return 200 with inspection detail (no-docs variant)', () => {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1/public/inspections/${inspectionId}/no-docs`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', inspectionId);
        });
    });

    it('should return 404 for non-existent ID', () => {
      return request(ctx.app.getHttpServer())
        .get(
          '/api/v1/public/inspections/00000000-0000-4000-a000-000000000000/no-docs',
        )
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  // ─── Public Changelog ─────────────────────────────────────────────────────────

  describe('GET /api/v1/public/inspections/:id/changelog', () => {
    let inspectionId: string;

    beforeAll(async () => {
      const inspection = await ctx.prisma.inspection.create({
        data: {
          vehiclePlateNumber: `INTTEST-PUB3`,
          inspectionDate: new Date(),
          overallRating: '70',
          status: InspectionStatus.ARCHIVED,
          identityDetails: {},
          vehicleData: {},
          equipmentChecklist: {},
          inspectionSummary: {},
          detailedAssessment: {},
          bodyPaintThickness: {},
          inspectorId: ctx.tokens.inspector.id,
          branchCityId: ctx.branchCityId,
          pretty_id: `IT-PCL-${Date.now()}`,
        },
      });
      inspectionId = inspection.id;

      // Create a changelog entry for this inspection
      await ctx.prisma.inspectionChangeLog.create({
        data: {
          inspectionId: inspection.id,
          changedByUserId: ctx.tokens.admin.id,
          fieldName: 'overallRating',
          oldValue: 65,
          newValue: 70,
        },
      });
    });

    it('should return 200 with changelog array', () => {
      return request(ctx.app.getHttpServer())
        .get(`/api/v1/public/inspections/${inspectionId}/changelog`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
          expect(res.body[0]).toHaveProperty('fieldName', 'overallRating');
        });
    });

    it('should return 404 for non-existent inspection changelog', () => {
      return request(ctx.app.getHttpServer())
        .get(
          '/api/v1/public/inspections/00000000-0000-4000-a000-000000000000/changelog',
        )
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
