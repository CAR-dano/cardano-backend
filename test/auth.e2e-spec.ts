/**
 * @fileoverview End-to-End tests for Authentication and Authorization flows for UI Users.
 * These tests simulate real HTTP requests to the running application instance
 * to verify the complete authentication (JWT, simulated Google callback) and
 * authorization (RBAC) mechanisms work as expected for internal users.
 * It uses supertest for making HTTP requests and interacts with a test database
 * managed by PrismaService. Tests related to External Developer API Keys are
 * excluded in this version.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import * as request from 'supertest'; // Use supertest for HTTP requests
import { AppModule } from './../src/app.module'; // Import main AppModule
import { PrismaService } from '../src/prisma/prisma.service'; // To clean DB
import { Role, User } from '@prisma/client'; // Import Role enum and User type
import { AuthService } from '../src/auth/auth.service'; // To generate tokens for tests
// UsersService might not be strictly needed if we create users via Prisma directly
// import { UsersService } from '../src/users/users.service';

describe('AuthController (e2e) - UI User Flows', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  // let usersService: UsersService; // Optional, depending on setup needs

  // --- Test User Data ---
  // Define data for users with different roles needed for tests
  const testAdminUser = {
    email: 'admin.e2e@test.com',
    name: 'E2E Admin',
    role: Role.ADMIN,
  };
  const testCustomerUser = {
    email: 'customer.e2e@test.com',
    name: 'E2E Customer',
    role: Role.CUSTOMER,
  };
  // Add other roles like EDITOR, INSPECTOR if needed for specific tests

  // Variables to hold generated tokens and user IDs for use across tests
  let adminJwtToken: string;
  let customerJwtToken: string;
  let adminUserId: string;
  let customerUserId: string;

  /**
   * Sets up the NestJS application instance before any tests run in this suite.
   * - Creates a testing module based on the main AppModule.
   * - Retrieves necessary services (Prisma, Auth).
   * - Applies global settings (prefix, validation pipe).
   * - Cleans the test database (users specifically).
   * - Creates necessary test users (admin, customer) directly via Prisma.
   * - Generates JWTs for the created test users via AuthService.
   * - Initializes the application.
   */
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global configurations consistent with main.ts
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    // Get services needed for setup and testing
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    // usersService = app.get(UsersService); // Get if needed

    // --- Database Cleanup & Setup ---
    console.log('[E2E Setup] Cleaning test users...');
    try {
      // Delete potentially existing test users from previous runs
      await prisma.user.deleteMany({
        where: { email: { contains: '.e2e@test.com' } },
      });
      console.log('[E2E Setup] Test users cleaned.');

      // Create necessary test users directly in the database
      console.log('[E2E Setup] Creating test users...');
      const admin = await prisma.user.create({ data: testAdminUser });
      const customer = await prisma.user.create({ data: testCustomerUser });
      adminUserId = admin.id;
      customerUserId = customer.id;
      console.log(
        `[E2E Setup] Test users created (Admin: ${adminUserId}, Customer: ${customerUserId})`,
      );

      // Generate JWTs for test users using AuthService.login
      console.log('[E2E Setup] Generating JWTs...');
      adminJwtToken = (
        await authService.login({
          id: admin.id,
          email: admin.email,
          role: admin.role,
          name: admin.name ?? undefined,
        })
      ).accessToken;
      customerJwtToken = (
        await authService.login({
          id: customer.id,
          email: customer.email,
          role: customer.role,
          name: customer.name ?? undefined,
        })
      ).accessToken;
      console.log('[E2E Setup] JWTs generated.');
    } catch (error) {
      console.error('[E2E Setup] CRITICAL ERROR during setup:', error);
      throw error; // Stop tests if setup fails
    }

    // Initialize the NestJS application to start listening for requests
    await app.init();
    console.log('[E2E Setup] Application initialized.');
  });

  /**
   * Cleans up after all tests in this suite have run.
   * - Disconnects Prisma client.
   * - Closes the NestJS application instance.
   */
  afterAll(async () => {
    console.log(
      '[E2E Teardown] Closing application and database connection...',
    );
    await prisma.$disconnect();
    await app.close();
    console.log('[E2E Teardown] Application closed.');
  });

  /**
   * Test suite for JWT Authentication endpoints relevant to UI users.
   */
  describe('JWT Authentication (/auth)', () => {
    /**
     * Tests accessing the protected user profile route without a JWT token.
     * Expects a 401 Unauthorized response.
     */
    it('/profile (GET) - should fail with 401 if no JWT token is provided', () => {
      return request(app.getHttpServer()) // Get the underlying HTTP server
        .get('/api/v1/auth/profile') // Target the endpoint
        .expect(HttpStatus.UNAUTHORIZED); // Assert the expected HTTP status
    });

    /**
     * Tests accessing the protected user profile route with an invalid JWT token.
     * Expects a 401 Unauthorized response.
     */
    it('/profile (GET) - should fail with 401 if JWT token is invalid', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token-123') // Set invalid Authorization header
        .expect(HttpStatus.UNAUTHORIZED);
    });

    /**
     * Tests accessing the protected user profile route with a valid JWT token (customer).
     * Expects a 200 OK response and checks if the returned body matches the
     * customer user's data (excluding sensitive fields like googleId).
     */
    it('/profile (GET) - should return user profile with valid JWT token (Customer)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${customerJwtToken}`) // Use the generated customer token
        .expect(HttpStatus.OK) // Expect 200 OK
        .expect((res) => {
          // Assert specific properties of the response body
          expect(res.body.id).toEqual(customerUserId);
          expect(res.body.email).toEqual(testCustomerUser.email);
          expect(res.body.role).toEqual(testCustomerUser.role);
          expect(res.body).not.toHaveProperty('googleId'); // Security check
          // Add more checks if needed (e.g., name)
          expect(res.body.name).toEqual(testCustomerUser.name);
        });
    });

    /**
     * Tests accessing the protected user profile route with a valid JWT token (admin).
     * Expects a 200 OK response and checks if the returned body matches the
     * admin user's data.
     */
    it('/profile (GET) - should return user profile with valid JWT token (Admin)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${adminJwtToken}`) // Use the generated admin token
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.id).toEqual(adminUserId);
          expect(res.body.email).toEqual(testAdminUser.email);
          expect(res.body.role).toEqual(testAdminUser.role);
          expect(res.body.name).toEqual(testAdminUser.name);
          expect(res.body).not.toHaveProperty('googleId');
        });
    });

    /**
     * Tests the logout endpoint with a valid JWT token.
     * Expects a 200 OK status and a success message in the body.
     * Note: For stateless JWT, this primarily tests if the endpoint is reachable
     * and protected by the JWT guard.
     */
    it('/logout (POST) - should return 200 OK with valid JWT token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${customerJwtToken}`) // Any valid token should work
        .expect(HttpStatus.OK)
        .expect((res) => {
          // Check the response message confirms logout initiation
          expect(res.body.message).toContain('Logout successful');
        });
    });

    /**
     * Tests the logout endpoint without providing a JWT token.
     * Expects a 401 Unauthorized response as the endpoint is protected.
     */
    it('/logout (POST) - should fail with 401 if no token provided', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  /**
   * Test suite for Role-Based Access Control (RBAC) verification.
   * Focuses on accessing admin-only routes with different user roles.
   */
  describe('Role-Based Access Control (Admin Routes)', () => {
    // Define an example route that should only be accessible by ADMIN role
    const adminOnlyRoute = '/api/v1/admin/users';

    /**
     * Tests accessing the admin route without any authentication.
     * Expects 401 Unauthorized.
     */
    it(`${adminOnlyRoute} (GET) - should fail with 401 if no JWT token provided`, () => {
      return request(app.getHttpServer())
        .get(adminOnlyRoute)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    /**
     * Tests accessing the admin route with a JWT token from a user with CUSTOMER role.
     * Expects 403 Forbidden due to insufficient permissions.
     */
    it(`${adminOnlyRoute} (GET) - should fail with 403 if user role is not ADMIN`, () => {
      return request(app.getHttpServer())
        .get(adminOnlyRoute)
        .set('Authorization', `Bearer ${customerJwtToken}`) // Use CUSTOMER token
        .expect(HttpStatus.FORBIDDEN); // Expect 403 Forbidden
    });

    /**
     * Tests accessing the admin route with a JWT token from a user with ADMIN role.
     * Expects 200 OK, indicating successful authorization.
     */
    it(`${adminOnlyRoute} (GET) - should succeed with 200 if user role is ADMIN`, () => {
      return request(app.getHttpServer())
        .get(adminOnlyRoute)
        .set('Authorization', `Bearer ${adminJwtToken}`) // Use ADMIN token
        .expect(HttpStatus.OK); // Expect 200 OK
    });

    // Add more tests here for other roles (EDITOR, INSPECTOR) if they should
    // or should not have access to specific admin routes.
    // Example:
    // it(`/api/v1/some/other/admin/route (POST) - should fail with 403 if role is EDITOR`, ...)
    // it(`/api/v1/admin/users/{id}/role (PUT) - should succeed with 200 if role is ADMIN`, ...)
  });

  /**
   * Placeholder test suite for Google OAuth flow simulation in E2E.
   * As mentioned before, directly testing the redirect flow is complex.
   * This section is kept as a placeholder for potential future implementation
   * using mocking strategies or dedicated test endpoints if required.
   */
  describe('Google OAuth Flow (Simulated Callback)', () => {
    it.todo('Implement Google OAuth E2E simulation if needed');
    // Example: test('/google/callback (GET) - should generate JWT and redirect after mock validation', ...)
  });
});
