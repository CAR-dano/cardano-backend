/*
 * --------------------------------------------------------------------------
 * File: auth.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Controller handling HTTP requests related to authentication for UI users.
 * Includes endpoints for initiating Google OAuth flow, handling the callback,
 * logging out (client-side for stateless JWT), and a sample protected endpoint
 * to demonstrate JWT validation.
 * --------------------------------------------------------------------------
 */

import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  Post,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express'; // Import Request & Response
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { User as UserModel, Role } from '@prisma/client'; // Rename import to avoid conflicts

// Define an interface for the request object after authentication
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role: Role;
  };
}

@ApiTags('Auth (UI Users)')
@Controller('auth') // Base path -> /api/v1/auth
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  /*
   * Constructor for AuthController.
   * Injects AuthService for business logic and ConfigService for configuration values.
   *
   * @param {AuthService} authService - The authentication service.
   * @param {ConfigService} configService - The configuration service.
   */
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /*
   * Endpoint to initiate the Google OAuth 2.0 authentication flow.
   * Applies the 'google' AuthGuard which automatically triggers the redirect to Google.
   *
   * @param {Request} req - The incoming request object.
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Initiate Google OAuth login',
    description:
      'Redirects user to Google for authentication. No request body needed.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirecting to Google for authentication.',
  })
  async googleAuth(@Req() req: Request) {
    this.logger.log('Initiating Google OAuth flow.');
    // Guard handles the redirect. No specific logic needed here.
  }

  /*
   * Callback endpoint that Google redirects to after user authentication.
   * Applies the 'google' AuthGuard to process the callback, validate the user via GoogleStrategy,
   * and attach the user object to `req.user`.
   * Generates a JWT upon success and redirects the user back to the frontend application.
   * Excluded from API documentation as it's part of the OAuth flow.
   *
   * @param {AuthenticatedRequest} req - The request object, potentially containing the validated user.
   * @param {Response} res - The response object used for redirection.
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint() // Hide from API documentation
  async googleAuthRedirect(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    this.logger.log('Received Google OAuth callback.');

    if (!req.user) {
      this.logger.error('Google authentication failed, req.user is missing.');
      const clientUrl =
        this.configService.getOrThrow<string>('CLIENT_BASE_URL');
      // Redirect to the frontend login page with an error message
      return res.redirect(`${clientUrl}/login?error=AuthenticationFailed`);
    }

    this.logger.log(
      `User authenticated via Google: ${req.user.email} (ID: ${req.user.id})`,
    );

    try {
      // Create JWT for validated users
      const { accessToken } = await this.authService.login(req.user);
      const clientUrl =
        this.configService.getOrThrow<string>('CLIENT_BASE_URL');

      this.logger.log(
        `JWT generated, redirecting user back to frontend: ${clientUrl}`,
      );

      // --- Redirect Method with Token in Query Parameter (Simple Example) ---
      // Notes: Consider the security of this method. It is better to set HttpOnly cookie.
      res.redirect(`${clientUrl}/auth/callback?token=${accessToken}`);

      // --- Contoh Set HttpOnly Cookie (Lebih Aman) ---
      /*
      const jwtExpirySeconds = parseInt(this.configService.getOrThrow<string>('JWT_EXPIRATION_TIME').replace('s', ''), 10);
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production', // true di production
        sameSite: 'lax', // 'ketat' atau 'longgar'
        maxAge: jwtExpirySeconds * 1000, // maxAge dalam milidetik
        path: '/', // Cookie berlaku untuk seluruh domain
      });
      res.redirect(`${clientUrl}/dashboard`); // Mengalihkan ke halaman setelah login berhasil
      */
    } catch (error) {
      this.logger.error(
        `Failed to process Google callback for user ${req.user.email}: ${error.message}`,
        error.stack,
      );
      const clientUrl =
        this.configService.getOrThrow<string>('CLIENT_BASE_URL');
      // Redirect to frontend login page with general error message
      res.redirect(`${clientUrl}/login?error=LoginProcessingFailed`);
    }
  }

  /*
   * Endpoint for user logout (primarily for client-side token clearing).
   * Requires a valid JWT to access.
   * If using HttpOnly cookies, this endpoint should clear the cookie.
   *
   * @param {AuthenticatedRequest} req - The request object containing the authenticated user.
   * @param {Response} res - The response object.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard) // Only logged-in users can logout
  @ApiBearerAuth('JwtAuthGuard') // Show this needs JWT in docs
  @ApiOperation({
    summary: 'Logout user',
    description:
      'Clears authentication state on the client side. Server does not maintain session for stateless JWT.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful (client should clear token).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    // For pure stateless JWT, the main logout happens on the client (remove token).
    // If using HttpOnly cookie, remove the cookie here: (uncomment)
    // res.clearCookie('access_token', { httpOnly: true, secure: ..., sameSite: ..., path: '/' });
    this.logger.log(
      `User logged out: ${req.user?.email} (ID: ${req.user?.id})`,
    );
    return res
      .status(HttpStatus.OK)
      .json({
        message:
          'Logout successful. Please clear your token/session on the client side.',
      });
  }

  /*
   * Sample protected endpoint to get the profile of the currently logged-in user.
   * Requires a valid JWT via the JwtAuthGuard.
   *
   * @param {AuthenticatedRequest} req - The request object containing the validated user.
   * @returns The user object attached by the JwtStrategy.
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard) // Protect with JWT Guard
  @ApiBearerAuth('JwtAuthGuard') // Indicate this needs JWT in docs
  @ApiOperation({ summary: 'Get logged-in user profile' })
  @ApiResponse({
    status: 200,
    description:
      "Returns the authenticated user's profile." /*, type: UserProfileDto */,
  }) // Replace with DTO if present
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: AuthenticatedRequest) {
    // req.user already contains data from JwtStrategy.validate
    this.logger.log(
      `Profile requested for user: ${req.user?.email} (ID: ${req.user?.id})`,
    );
    return req.user; // Return user data
  }
}
