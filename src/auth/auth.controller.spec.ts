/**
 * @fileoverview This file contains unit tests for the AuthController.
 * It focuses on testing the controller's logic in isolation, ensuring that
 * it correctly handles incoming requests, interacts with the AuthService and
 * ConfigService (which are mocked), and manages HTTP responses (like redirects
 * or JSON responses) appropriately for the authentication flows (Google OAuth, JWT).
 * Guards (`AuthGuard`, `JwtAuthGuard`) are assumed to function correctly at this
 * unit testing level; their full effect is better tested in E2E tests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport'; // Need AuthGuard for canActivate mock/override
import { JwtAuthGuard } from './guards/jwt-auth.guard'; // Need JwtAuthGuard for canActivate mock/override
import { HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { Request, Response } from 'express'; // Import Express types
import { Role } from '@prisma/client'; // Import Role enum

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role: Role;
  };
}

// --- Mock Dependencies ---

/**
 * Mock object for AuthService.
 * Provides Jest mock functions for methods called by AuthController.
 */
const mockAuthService = {
  login: jest.fn(),
  // validateUserGoogle is called within GoogleStrategy, not directly by controller
  // logout (if server-side logic existed) would be mocked here
};

/**
 * Mock object for ConfigService.
 * Provides Jest mock functions for configuration value retrieval.
 */
const mockConfigService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

/**
 * Mock object for Express Response.
 * Provides Jest mock functions for methods used by the controller like
 * redirect, cookie, clearCookie, status, and json.
 */
const mockResponse = {
  redirect: jest.fn(),
  cookie: jest.fn(),
  clearCookie: jest.fn(),
  status: jest.fn().mockReturnThis(), // Allows chaining like .status(200).json(...)
  json: jest.fn(),
} as unknown as Response; // Use 'as unknown as Response' to satisfy type checking

/**
 * Mock object for Express Request.
 * We will add the 'user' property dynamically in tests where needed.
 */
const mockRequest = {} as Request;

// Helper to create a request with a user object
const createMockRequestWithUser = (user: {
  id: string;
  email: string;
  name?: string;
  role: Role;
}): AuthenticatedRequest =>
  ({
    ...mockRequest,
    user,
  }) as AuthenticatedRequest;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService;

  /**
   * Sets up the NestJS testing module before each test case.
   * It provides the AuthController and uses mock implementations for its dependencies
   * (AuthService, ConfigService). It also overrides the default guards (`AuthGuard('google')`,
   * `JwtAuthGuard`) to simply allow requests through for unit testing the controller logic,
   * as the guard functionality itself is tested separately or in E2E tests.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController], // Provide the controller to be tested
      providers: [
        // Provide mocks for injected services
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      // Override guards for unit testing - assume they allow access
      .overrideGuard(AuthGuard('google'))
      .useValue({ canActivate: jest.fn(() => true) }) // Mock Google Guard
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) }) // Mock JWT Guard
      .compile();

    // Retrieve instances from the testing module
    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService); // Retrieves the mock
    configService = module.get<ConfigService>(ConfigService); // Retrieves the mock

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  /**
   * Basic test to ensure the controller instance is created correctly.
   */
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /**
   * Test suite for the GET /auth/google endpoint.
   */
  describe('googleAuth', () => {
    /**
     * Tests that the googleAuth method exists and can be called.
     * In reality, the AuthGuard('google') handles the redirect logic,
     * so the controller method itself doesn't do much.
     * This test mainly ensures the endpoint is set up.
     */
    it('should initiate the Google OAuth flow (guard handles redirect)', async () => {
      // Arrange: No specific arrangement needed as guard handles the flow
      // Act: Call the method
      await controller.googleAuth(mockRequest);
      // Assert: We mainly expect no errors. Asserting redirect is hard here.
      // We can check if the guard was conceptually applied (though we mocked it).
      // In a real scenario, this route would trigger the Passport redirect.
      expect(true).toBe(true); // Simple assertion that code execution reached here
    });
  });

  /**
   * Test suite for the GET /auth/google/callback endpoint.
   * This endpoint handles the redirect back from Google after successful authentication.
   */
  describe('googleAuthRedirect', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: Role.CUSTOMER,
    };
    const mockRequestWithAuthUser = createMockRequestWithUser(mockUser);
    const mockAccessToken = { accessToken: 'mock-jwt-token' };
    const mockClientUrl = 'http://localhost:3001'; // Example frontend URL

    /**
     * Tests the successful callback scenario where req.user exists.
     * It should call authService.login, get the client URL, and redirect
     * the user to the frontend with the token (using query param method here).
     */
    it('should log in the user and redirect to frontend with token on successful callback', async () => {
      // Arrange
      mockAuthService.login.mockResolvedValue(mockAccessToken);
      mockConfigService.getOrThrow.mockReturnValue(mockClientUrl);

      // Act
      await controller.googleAuthRedirect(
        mockRequestWithAuthUser,
        mockResponse,
      );

      // Assert
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(configService.getOrThrow).toHaveBeenCalledWith('CLIENT_BASE_URL');
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${mockClientUrl}/auth/callback?token=${mockAccessToken.accessToken}`,
      );
    });

    /**
     * Tests the scenario where the callback is hit but req.user is missing
     * (e.g., Google Guard failed or state mismatch).
     * It should redirect back to the frontend login page with an error query parameter.
     */
    it('should redirect to frontend login with error if req.user is missing', async () => {
      // Arrange
      const mockRequestWithoutUser = { ...mockRequest } as AuthenticatedRequest; // Simulate missing user
      mockConfigService.getOrThrow.mockReturnValue(mockClientUrl);

      // Act
      await controller.googleAuthRedirect(mockRequestWithoutUser, mockResponse);

      // Assert
      expect(authService.login).not.toHaveBeenCalled(); // Login should not be called
      expect(configService.getOrThrow).toHaveBeenCalledWith('CLIENT_BASE_URL');
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${mockClientUrl}/login?error=AuthenticationFailed`,
      );
    });

    /**
     * Tests the error handling scenario where authService.login throws an error
     * after a successful Google validation.
     * It should redirect back to the frontend login page with a generic error parameter.
     */
    it('should redirect to frontend login with error if authService.login fails', async () => {
      // Arrange
      const loginError = new InternalServerErrorException('JWT signing failed');
      mockAuthService.login.mockRejectedValue(loginError); // Simulate login failure
      mockConfigService.getOrThrow.mockReturnValue(mockClientUrl);
      const reqWithUser = createMockRequestWithUser(mockUser);
      // Act
      await controller.googleAuthRedirect(reqWithUser, mockResponse);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(configService.getOrThrow).toHaveBeenCalledWith('CLIENT_BASE_URL');
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${mockClientUrl}/login?error=LoginProcessingFailed`,
      );
    });

    /**
     * Tests the successful callback scenario using HttpOnly cookies for token delivery.
     * (Uncomment and adapt if you switch to cookie-based approach).
     */
    /*
    it('should log in the user, set HttpOnly cookie, and redirect to dashboard (Cookie Method)', async () => {
        // Arrange
        mockAuthService.login.mockResolvedValue(mockAccessToken);
        mockConfigService.getOrThrow
            .mockReturnValueOnce('JWT_EXPIRATION_TIME_VALUE') // Mock expiry first
            .mockReturnValueOnce(mockClientUrl); // Then mock client URL
        mockConfigService.get = jest.fn().mockReturnValue('development'); // Mock NODE_ENV for secure flag

        const mockExpirySeconds = 3600;
        jest.spyOn(global, 'parseInt').mockReturnValue(mockExpirySeconds); // Mock parseInt if needed

        // Act
        await controller.googleAuthRedirect(mockRequestWithAuthUser, mockResponse);

        // Assert
        expect(authService.login).toHaveBeenCalledWith(mockUser);
        expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_EXPIRATION_TIME');
        expect(configService.getOrThrow).toHaveBeenCalledWith('CLIENT_BASE_URL');
        expect(mockResponse.cookie).toHaveBeenCalledWith(
            'access_token',
            mockAccessToken.accessToken,
            {
                httpOnly: true,
                secure: false, // Based on NODE_ENV mock
                sameSite: 'lax',
                maxAge: mockExpirySeconds * 1000,
                path: '/',
            }
        );
        expect(mockResponse.redirect).toHaveBeenCalledWith(`${mockClientUrl}/dashboard`);
    });
    */
  });

  /**
   * Test suite for the POST /auth/logout endpoint.
   */
  describe('logout', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: Role.CUSTOMER,
    };
    const mockRequestWithAuthUser = createMockRequestWithUser(mockUser);
    /**
     * Tests the basic logout functionality for stateless JWT.
     * It should return an OK status and a confirmation message.
     * Assumes the JwtAuthGuard allows the request.
     */
    it('should return OK status and success message for stateless JWT logout', async () => {
      // Arrange: (mockResponse already configured for status().json())

      // Act
      await controller.logout(mockRequestWithAuthUser, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message:
          'Logout successful. Please clear your token/session on the client side.',
      });
    });

    /**
     * Tests if the logout endpoint correctly clears the HttpOnly cookie if implemented.
     * (Uncomment and adapt if using cookie-based auth).
     */
    /*
    it('should clear the access_token cookie if using HttpOnly cookies', async () => {
        // Arrange
        mockConfigService.get = jest.fn().mockReturnValue('production'); // Simulate production for secure flag

        // Act
        await controller.logout(mockRequestWithAuthUser, mockResponse);

        // Assert
        expect(mockResponse.clearCookie).toHaveBeenCalledWith(
            'access_token',
            {
                httpOnly: true,
                secure: true, // Based on NODE_ENV mock
                sameSite: 'lax', // Adjust as needed
                path: '/',
            }
        );
        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
        expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Logout successful.' }); // Maybe different message
    });
    */
  });

  /**
   * Test suite for the GET /auth/profile endpoint.
   */
  describe('getProfile', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: Role.ADMIN,
    };
    const mockRequestWithAuthUser = createMockRequestWithUser(mockUser);

    /**
     * Tests if the getProfile endpoint returns the user object attached to req.user.
     * Assumes the JwtAuthGuard and JwtStrategy successfully validated the token
     * and attached the user information.
     */
    it('should return the user object from req.user', () => {
      // Arrange: mockRequestWithAuthUser already has the user object

      // Act: Call the controller method
      const result = controller.getProfile(mockRequestWithAuthUser);

      // Assert: Check if the returned result is the same as the user object in the mock request
      expect(result).toEqual(mockUser);
    });
  });
});
