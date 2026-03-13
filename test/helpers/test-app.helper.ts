/**
 * @fileoverview Shared test application helper for E2E integration tests.
 * Provides a singleton-like pattern so that all test suites sharing the same
 * NestJS application instance don't re-bootstrap for every file.
 *
 * Usage:
 *   const { app, prisma, authService, tokens } = await getTestApp();
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthService } from '../../src/auth/auth.service';
import { AllExceptionsFilter } from '../../src/common/filters';
import { Role } from '@prisma/client';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Tokens & IDs for each role created during setup */
export interface TestTokens {
  admin: { id: string; accessToken: string; refreshToken: string };
  superadmin: { id: string; accessToken: string; refreshToken: string };
  reviewer: { id: string; accessToken: string; refreshToken: string };
  inspector: { id: string; accessToken: string; refreshToken: string };
  customer: { id: string; accessToken: string; refreshToken: string };
}

export interface TestAppContext {
  app: INestApplication;
  prisma: PrismaService;
  authService: AuthService;
  tokens: TestTokens;
  /** Branch city used as FK for inspectors / inspections */
  branchCityId: string;
}

// Suffix for all test-created data — easy to find & clean up
export const E2E_SUFFIX = '.inttest@test.com';

let cachedContext: TestAppContext | null = null;

/**
 * Bootstrap (or re-use) a fully configured NestJS application
 * with global prefix, pipes, and filters matching production `main.ts`.
 */
export async function getTestApp(): Promise<TestAppContext> {
  if (cachedContext) return cachedContext;

  // Globally disable ThrottlerGuard by overriding the prototype method.
  // This is the most reliable way because NestJS APP_GUARD multi-providers
  // and @UseGuards(ThrottlerGuard) both create instances of ThrottlerGuard
  // that aren't easily overridden via .overrideProvider() or .overrideGuard().
  jest
    .spyOn(ThrottlerGuard.prototype, 'canActivate')
    .mockResolvedValue(true);

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Mirror production configuration from main.ts
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
      disableErrorMessages: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const prisma = app.get(PrismaService);
  const authService = app.get(AuthService);

  // Clean up any leftover test data from previous runs
  await cleanupTestData(prisma);

  // Create a branch city for FK references
  const branch = await prisma.inspectionBranchCity.create({
    data: { city: `TestCity-IntTest`, code: 'IT', isActive: true },
  });

  // Create test users for each role
  const tokens = await createTestUsers(prisma, authService, branch.id);

  await app.init();

  cachedContext = { app, prisma, authService, tokens, branchCityId: branch.id };
  return cachedContext;
}

/**
 * Tear down the shared app instance. Call this in a global afterAll.
 */
export async function closeTestApp(): Promise<void> {
  if (!cachedContext) return;
  const { app, prisma } = cachedContext;

  await cleanupTestData(prisma);
  await prisma.$disconnect();
  await app.close();
  cachedContext = null;
}

/**
 * Remove all test-created records (order respects FK constraints).
 */
export async function cleanupTestData(prisma: PrismaService): Promise<void> {
  // Delete in dependency order
  await prisma.inspectionChangeLog.deleteMany({
    where: {
      inspection: { vehiclePlateNumber: { startsWith: 'INTTEST' } },
    },
  });
  await prisma.photo.deleteMany({
    where: {
      inspection: { vehiclePlateNumber: { startsWith: 'INTTEST' } },
    },
  });
  await prisma.inspection.deleteMany({
    where: { vehiclePlateNumber: { startsWith: 'INTTEST' } },
  });
  await prisma.blacklistedToken.deleteMany({
    where: { token: { startsWith: 'inttest-' } },
  });
  // Clean up users created directly (with dot: admin.inttest@test.com)
  // and users registered via API (normalized, no dot: regXXXinttest@test.com)
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { contains: E2E_SUFFIX } },
        { email: { contains: 'inttest@test.com' } },
      ],
    },
  });
  await prisma.inspectionBranchCity.deleteMany({
    where: { city: { startsWith: 'TestCity-IntTest' } },
  });
}

/**
 * Create one user per role and return JWT tokens for each.
 */
async function createTestUsers(
  prisma: PrismaService,
  authService: AuthService,
  branchCityId: string,
): Promise<TestTokens> {
  const roles: { key: keyof TestTokens; role: Role; extra?: Record<string, any> }[] = [
    { key: 'superadmin', role: Role.SUPERADMIN },
    { key: 'admin', role: Role.ADMIN },
    { key: 'reviewer', role: Role.REVIEWER },
    {
      key: 'inspector',
      role: Role.INSPECTOR,
      extra: { inspectionBranchCityId: branchCityId, pin: '999999' },
    },
    { key: 'customer', role: Role.CUSTOMER },
  ];

  const tokens = {} as TestTokens;

  for (const { key, role, extra } of roles) {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `${key}${E2E_SUFFIX}`,
        username: `inttest_${key}`,
        name: `IntTest ${key}`,
        role,
        isActive: true,
        ...extra,
      },
    });

    const loginResult = await authService.login({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? undefined,
      username: user.username ?? undefined,
    });

    tokens[key] = {
      id: user.id,
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
    };
  }

  return tokens;
}
