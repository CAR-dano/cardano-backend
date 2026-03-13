/**
 * @fileoverview Integration tests for Dashboard endpoints.
 * All endpoints require JwtAuthGuard + RolesGuard.
 * Covers: main-stats, order-trend, branch-distribution, inspector-performance.
 *
 * NOTE: All dashboard service methods require start_date and end_date despite
 * the DTO marking them as @IsOptional(). The service throws BadRequestException
 * if either is missing. Tests always provide both.
 */

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { getTestApp, closeTestApp, TestAppContext } from './helpers';

describe('DashboardController (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  const dashRoute = '/api/v1/dashboard';

  // Default query params that all dashboard endpoints require
  const defaultQuery = {
    start_date: '2025-01-01',
    end_date: '2025-12-31',
    timezone: 'Asia/Jakarta',
  };

  // ─── Main Stats ───────────────────────────────────────────────────────────────

  describe('GET /api/v1/dashboard/main-stats', () => {
    it('should return 200 with stats for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/main-stats`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toBeDefined();
          expect(typeof res.body).toBe('object');
        });
    });

    it('should return 200 for REVIEWER', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/main-stats`)
        .set('Authorization', `Bearer ${ctx.tokens.reviewer.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.OK);
    });

    it('should return 200 with custom date range', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/main-stats`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .query({
          start_date: '2025-06-01',
          end_date: '2025-06-30',
          timezone: 'Asia/Jakarta',
        })
        .expect(HttpStatus.OK);
    });

    it('should return 400 when start_date/end_date are missing', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/main-stats`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .query({ timezone: 'Asia/Jakarta' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 403 for CUSTOMER', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/main-stats`)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 403 for INSPECTOR', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/main-stats`)
        .set('Authorization', `Bearer ${ctx.tokens.inspector.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 401 without auth', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/main-stats`)
        .query(defaultQuery)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  // ─── Order Trend ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/dashboard/order-trend', () => {
    it('should return 200 for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/order-trend`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.OK);
    });

    it('should return 200 for SUPERADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/order-trend`)
        .set('Authorization', `Bearer ${ctx.tokens.superadmin.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.OK);
    });

    it('should return 403 for REVIEWER', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/order-trend`)
        .set('Authorization', `Bearer ${ctx.tokens.reviewer.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── Branch Distribution ──────────────────────────────────────────────────────

  describe('GET /api/v1/dashboard/branch-distribution', () => {
    it('should return 200 for ADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/branch-distribution`)
        .set('Authorization', `Bearer ${ctx.tokens.admin.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.OK);
    });

    it('should return 403 for REVIEWER', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/branch-distribution`)
        .set('Authorization', `Bearer ${ctx.tokens.reviewer.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // ─── Inspector Performance ────────────────────────────────────────────────────

  describe('GET /api/v1/dashboard/inspector-performance', () => {
    it('should return 200 for SUPERADMIN', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/inspector-performance`)
        .set('Authorization', `Bearer ${ctx.tokens.superadmin.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.OK);
    });

    it('should return 403 for CUSTOMER', () => {
      return request(ctx.app.getHttpServer())
        .get(`${dashRoute}/inspector-performance`)
        .set('Authorization', `Bearer ${ctx.tokens.customer.accessToken}`)
        .query(defaultQuery)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});
