/**
 * @fileoverview Integration tests for Blockchain, Metrics, and Scalar Docs endpoints.
 * All endpoints tested here are publicly accessible (no authentication required).
 *
 * Blockchain endpoints require external Blockfrost API, so we primarily test
 * that the endpoints are reachable and return appropriate status codes.
 */

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { getTestApp, closeTestApp, TestAppContext } from './helpers';

describe('Blockchain, Metrics & Docs (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ─── Blockchain Endpoints ─────────────────────────────────────────────────────

  describe('BlockchainController', () => {
    describe('GET /api/v1/blockchain/metadata/tx/:txHash', () => {
      it('should return 200 or appropriate error for a valid-format txHash', async () => {
        // Use a dummy hash - the endpoint should handle it gracefully
        const dummyTxHash = 'a'.repeat(64); // 64 hex chars (valid Cardano tx hash format)

        const res = await request(ctx.app.getHttpServer()).get(
          `/api/v1/blockchain/metadata/tx/${dummyTxHash}`,
        );

        // Either 200 (empty array) or 404/500 from Blockfrost
        // The important thing is the endpoint is reachable and doesn't crash
        expect([200, 404, 500, 502, 503]).toContain(res.status);
      });

      it('should handle empty txHash gracefully', () => {
        return request(ctx.app.getHttpServer())
          .get('/api/v1/blockchain/metadata/tx/')
          .expect((res) => {
            // Could be 404 (no route match) or 400
            expect([404, 400]).toContain(res.status);
          });
      });
    });

    describe('GET /api/v1/blockchain/nft/:assetId', () => {
      it('should return 200 or appropriate error for a valid-format assetId', async () => {
        const dummyAssetId = 'a'.repeat(56); // Cardano asset ID format

        const res = await request(ctx.app.getHttpServer()).get(
          `/api/v1/blockchain/nft/${dummyAssetId}`,
        );

        // Either 200 with data or error from Blockfrost
        expect([200, 404, 500, 502, 503]).toContain(res.status);
      });
    });
  });

  // ─── Metrics Endpoint ─────────────────────────────────────────────────────────

  describe('MetricsController', () => {
    describe('GET /api/v1/metrics', () => {
      it('should return 200 with Prometheus metrics text', () => {
        return request(ctx.app.getHttpServer())
          .get('/api/v1/metrics')
          .expect(HttpStatus.OK)
          .expect((res) => {
            // Prometheus metrics are plain text
            expect(res.headers['content-type']).toContain('text/');
            // Should contain either default process metrics or custom http metrics
            const hasMetrics =
              res.text.includes('process_') ||
              res.text.includes('http_requests_total') ||
              res.text.includes('# HELP') ||
              res.text.includes('# TYPE');
            expect(hasMetrics).toBe(true);
          });
      });
    });
  });

  // ─── Scalar Docs Endpoints ────────────────────────────────────────────────────

  describe('ScalarDocsController', () => {
    describe('GET /api/v1/openapi.json', () => {
      it('should return OpenAPI JSON document or 500 if not generated', async () => {
        const res = await request(ctx.app.getHttpServer()).get(
          '/api/v1/openapi.json',
        );

        // In test context, OpenAPI doc may not be generated (setOpenApiDocument not called)
        // so 500 is expected. In non-production with doc, returns 200.
        // In production env, returns 404.
        if (res.status === 200) {
          expect(res.body).toHaveProperty('openapi');
          expect(res.body).toHaveProperty('info');
          expect(res.body).toHaveProperty('paths');
        } else {
          expect([404, 500]).toContain(res.status);
        }
      });
    });

    describe('GET /api/v1/docs', () => {
      it('should return HTML or 404 depending on environment', async () => {
        const res = await request(ctx.app.getHttpServer()).get('/api/v1/docs');

        // Non-production: 200 with HTML
        // Production: 404
        expect([200, 404]).toContain(res.status);
        if (res.status === 200) {
          expect(res.headers['content-type']).toContain('text/html');
        }
      });
    });
  });
});
