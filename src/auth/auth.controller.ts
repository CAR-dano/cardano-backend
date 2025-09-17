/*
 * --------------------------------------------------------------------------
 * File: auth.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller handling HTTP requests related to authentication for UI users
 * (Local email/username/password, Google OAuth) and profile management.
 * It manages routes for local registration, login, Google OAuth flow, logout,
 * and retrieving user profiles.
 * --------------------------------------------------------------------------
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  HttpCode,
  InternalServerErrorException,
  UnauthorizedException, // Import UnauthorizedException
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  ApiAuthErrors,
  ApiStandardErrors,
} from '../common/decorators/api-standard-errors.decorator';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard'; // Protects profile & logout
import { LocalAuthGuard } from './guards/local-auth.guard'; // Triggers local strategy for login
import { Role, User } from '@prisma/client'; // Import Role for interface
import { RegisterUserDto } from './dto/register-user.dto'; // DTO for local registration
import { LoginUserDto } from './dto/login-user.dto'; // DTO for local login input
import { LoginResponseDto } from './dto/login-response.dto'; // DTO for successful login response
import { UserResponseDto } from '../users/dto/user-response.dto'; // DTO for profile response
import { GetUser } from './decorators/get-user.decorator'; // Custom decorator to get user
import { JwtService } from '@nestjs/jwt'; // Import JwtService
import { ExtractJwt } from 'passport-jwt'; // Import ExtractJwt
import { InspectorGuard } from './guards/inspector.guard';
import { LoginInspectorDto } from './dto/login-inspector.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LinkGoogleDto } from './dto/link-google.dto';
import { LinkWalletDto } from './dto/link-wallet.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileValidationPipe } from '../inspections/pipes/file-validation.pipe';
import { memoryStorage } from 'multer';
import type { Express } from 'express';

const profilePhotoStorage = memoryStorage();

// Define interface for request object after JWT or Local auth guard runs
interface AuthenticatedRequest extends Request {
  user?: UserResponseDto; // Use UserResponseDto structure here
}

@ApiTags('Auth (UI Users)')
@Controller('auth') // Base path: /api/v1/auth
export class AuthController {
  private readonly logger: AppLogger;

  /**
   * Constructs the AuthController.
   * @param authService - The authentication service.
   * @param usersService - The users service.
   * @param configService - The configuration service.
   * @param jwtService - The JWT service for token decoding.
   */
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService, // Inject JwtService
    logger: AppLogger,
    private readonly audit: AuditLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(AuthController.name);
  }

  /**
   * Handles local user registration (Email/Username + Password).
   *
   * @param registerUserDto - Contains email, username, password, name, walletAddress.
   * @returns {Promise<UserResponseDto>} The newly created user profile (excluding sensitive data).
   */
  @Post('register')
  @ApiOperation({ summary: 'Register a new user locally' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiBody({ type: RegisterUserDto })
  @ApiCreatedResponse({
    description: 'User successfully registered.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data.',
    type: HttpErrorResponseDto,
  })
  async registerLocal(
    @Body() registerUserDto: RegisterUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `Attempting local registration for username: ${registerUserDto.username}`,
    );
    // AuthService.registerLocalUser (or similar method in UsersService) handles hashing and saving
    const newUser = await this.usersService.createLocalUser(registerUserDto); // Assume method exists in AuthService/UsersService
    return new UserResponseDto(newUser); // Return safe DTO
  }

  /**
   * Handles local user login (Email/Username + Password).
   * Uses LocalAuthGuard to validate credentials via LocalStrategy.
   * If successful, Passport attaches the user object to req.user.
   * Calls AuthService.login to generate JWT.
   *
   * @param req - The request object with user attached by LocalAuthGuard.
   * @param loginUserDto - DTO containing loginIdentifier and password (used by guard).
   * @returns {Promise<LoginResponseDto>} JWT access token and user details.
   */
  @Post('login')
  @UseGuards(LocalAuthGuard) // Apply LocalAuthGuard to trigger LocalStrategy validation
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK) // Return 200 OK on successful login
  @ApiOperation({
    summary: 'Login with local credentials (email/username + password)',
  })
  @ApiBody({ type: LoginUserDto })
  @ApiOkResponse({
    description: 'Login successful, JWT returned.',
    type: LoginResponseDto,
  })
  @ApiStandardErrors({ forbidden: false, notFound: false })
  async loginLocal(
    @Req() req: AuthenticatedRequest, // Request now has req.user populated by LocalAuthGuard/LocalStrategy
    // @Body() loginUserDto: LoginUserDto // Body is implicitly used by LocalStrategy, no need to inject again unless needed explicitly
  ): Promise<LoginResponseDto> {
    if (!req.user) {
      // Ini seharusnya tidak terjadi jika guard bekerja, tapi tambahkan check untuk keamanan
      this.logger.error('LocalAuthGuard succeeded but req.user is missing!');
      throw new InternalServerErrorException('Authentication flow error.');
    }

    const user = req.user as unknown as User;

    if (user.isActive === false) {
      this.logger.warn(`Login attempt from inactive user account: ${user.id}`);
      throw new UnauthorizedException(
        'User account is inactive. Please contact an administrator.',
      );
    }

    this.logger.log(
      `User logged in locally: ${req.user?.email ?? req.user?.username}`,
    );
    // req.user contains the validated user object returned by LocalStrategy.validate
    const { accessToken, refreshToken } = await this.authService.login(
      req.user as any,
    ); // Generate JWT
    // Audit
    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: (req.user as any).id,
      action: 'LOGIN',
      resource: 'user',
      subjectId: (req.user as any).id,
      result: 'SUCCESS',
      ip: (req as any)?.ip,
      meta: { method: 'local' },
    });
    return {
      accessToken,
      refreshToken,
      user: new UserResponseDto(req.user as any), // Cast req.user to User for DTO constructor
    };
  }

  /**
   * Handles inspector login using a PIN.
   * Uses InspectorGuard to validate the PIN.
   * If successful, the guard attaches the user object to req.user.
   * Calls AuthService.login to generate JWT.
   *
   * @param req - The request object with user attached by InspectorGuard.
   * @returns {Promise<LoginResponseDto>} JWT access token, refresh token, and user details.
   */
  @Post('login/inspector')
  @UseGuards(InspectorGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login for inspectors with PIN' })
  @ApiBody({ type: LoginInspectorDto })
  @ApiOkResponse({
    description: 'Login successful, JWT returned.',
    type: LoginResponseDto,
  })
  @ApiStandardErrors({ forbidden: false, notFound: false })
  async loginInspector(
    @Req() req: AuthenticatedRequest,
  ): Promise<LoginResponseDto> {
    if (!req.user) {
      this.logger.error('LocalPinAuthGuard succeeded but req.user is missing!');
      throw new InternalServerErrorException('Authentication flow error.');
    }

    const inspector = req.user as unknown as User;

    if (inspector.isActive === false) {
      this.logger.warn(
        `Login attempt from inactive inspector account: ${inspector.id}`,
      );
      throw new UnauthorizedException(
        'Inspector account is inactive. Please contact an administrator.',
      );
    }

    this.logger.log(`Inspector logged in: ${inspector.id}`);
    const { accessToken, refreshToken } = await this.authService.login(
      req.user as any,
    );
    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: (req.user as any).id,
      action: 'LOGIN',
      resource: 'user',
      subjectId: (req.user as any).id,
      result: 'SUCCESS',
      ip: (req as any)?.ip,
      meta: { method: 'inspector_pin' },
    });
    return {
      accessToken,
      refreshToken,
      user: new UserResponseDto(req.user as any),
    };
  }

  /**
   * Generates a new access token using a valid refresh token.
   * Uses JwtRefreshGuard to validate the refresh token.
   * If successful, the guard attaches the user payload to req.user.
   *
   * @param req - The request object with user payload attached by JwtRefreshGuard.
   * @returns {Promise<{ accessToken: string, refreshToken: string }>} A new pair of access and refresh tokens.
   */
  @Post('refresh')
  @SkipThrottle()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain a new access token using a refresh token' })
  @ApiBearerAuth('jwt-refresh') // Specify the auth scheme for Swagger
  @ApiOkResponse({ description: 'New tokens generated successfully.' })
  @ApiAuthErrors()
  async refreshTokens(@Req() req: AuthenticatedRequest) {
    if (!req.user) {
      this.logger.error('JwtRefreshGuard succeeded but req.user is missing!');
      throw new InternalServerErrorException('Authentication flow error.');
    }
    const userId = req.user.id;
    return this.authService.refreshTokens(userId);
  }

  /**
   * Initiates the Google OAuth 2.0 authentication flow.
   * Redirects the user to Google's login page.
   */
  @Get('google')
  @SkipThrottle()
  @UseGuards(AuthGuard('google')) // Trigger GoogleStrategy
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirecting to Google.' })
  async googleAuth(@Req() req: Request) {
    this.logger.log('Initiating Google OAuth flow.');
    // Passport's Google strategy handles the redirect automatically
  }

  /**
   * Handles the callback from Google after successful authentication.
   * GoogleStrategy validates the profile and attaches user info to req.user.
   * Generates JWT and redirects back to the frontend.
   */
  @Get('google/callback')
  @SkipThrottle()
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint() // Typically hidden from public API docs
  async googleAuthRedirect(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    this.logger.log('Received Google OAuth callback.');
    const clientUrl = this.configService.getOrThrow<string>(
      'CLIENT_BASE_URL_GOOGLE',
    );
    if (!req.user) {
      this.logger.error(
        'Google OAuth callback error: req.user is missing after guard execution.',
      );
      const clientErrorUrl = `${clientUrl}/auth?error=authentication-failed`;
      return res.redirect(clientErrorUrl);
    }

    try {
      // The user object from GoogleStrategy.validate is in req.user
      const { accessToken, refreshToken } = await this.authService.login(
        req.user as any,
      );

      // Successful login, redirect to frontend with tokens
      // It's generally safer to pass tokens in a query parameter for a one-time read
      res.redirect(
        `${clientUrl}/auth?token=${accessToken}&refreshToken=${refreshToken}`,
      );
    } catch (error) {
      this.logger.error(
        `Error during Google authentication post-processing: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Redirect to an error page on the client
      const clientErrorUrl = `${clientUrl}/auth?error=authentication-failed`;
      res.redirect(clientErrorUrl);
    }
  }

  /**
   * Logs out the user (primarily client-side for stateless JWT).
   * Requires a valid JWT.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard) // Protect this endpoint
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiBearerAuth('JwtAuthGuard') // Document requirement
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiOkResponse({
    description: 'Logout successful (client should clear token).',
  })
  @ApiAuthErrors()
  async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    this.logger.log(`User logged out: ${req.user?.email ?? req.user?.id}`);

    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    if (!token) {
      this.logger.warn('Logout failed: No token provided in request.');
      throw new UnauthorizedException('No token provided.');
    }

    try {
      // Decode the token to get its expiration time
      const decodedToken = this.jwtService.decode(token);
      if (!decodedToken || !decodedToken.exp) {
        this.logger.warn(
          'Logout failed: Invalid token format (missing expiration).',
        );
        throw new UnauthorizedException('Invalid token format.');
      }

      const expiresAt = new Date(decodedToken.exp * 1000); // Convert Unix timestamp to Date object

      // Blacklist the token
      await this.authService.blacklistToken(token, expiresAt);

      return res.json({
        message: 'Logout successful. Token has been invalidated on the server.',
      });
    } catch (error) {
      this.logger.error(
        `Error during server-side logout for user ${req.user?.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to process logout.');
    }
  }

  /**
   * Retrieves the profile of the currently authenticated user.
   * Requires a valid JWT. Uses the custom @GetUser decorator.
   *
   * @param {UserResponseDto} user - The authenticated user object injected by @GetUser.
   * @returns {UserResponseDto} The user's profile information.
   */
  @Get('profile')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard) // Protect with JWT
  @ApiBearerAuth('JwtAuthGuard') // Document requirement
  @ApiOperation({ summary: 'Get logged-in user profile' })
  @ApiOkResponse({
    description: 'Returns authenticated user profile.',
    type: UserResponseDto,
  })
  @ApiAuthErrors()
  getProfile(@GetUser() user: UserResponseDto): UserResponseDto {
    // Use decorator to get user
    this.logger.log(`Profile requested for user: ${user.email ?? user.id}`);
    // The 'user' object here is already filtered by JwtStrategy/UserResponseDto structure
    return user;
  }

  @Patch('profile')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Update logged-in user profile information' })
  @ApiOkResponse({ description: 'Updated profile.', type: UserResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid profile payload.',
    type: HttpErrorResponseDto,
  })
  @ApiAuthErrors()
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @GetUser() authUser: any,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.updateSelfProfile(authUser.id, dto);

    const changedFields = Object.entries(dto)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key]) => key);

    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: authUser.id,
      actorRole: authUser.role,
      action: 'PROFILE_UPDATE',
      resource: 'user_profile',
      subjectId: authUser.id,
      result: 'SUCCESS',
      meta: { changedFields },
    });

    return new UserResponseDto(updated as any);
  }

  @Patch('profile/password')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Change password for logged-in user' })
  @ApiOkResponse({ description: 'Password updated successfully.' })
  @ApiBadRequestResponse({
    description: 'Invalid password payload.',
    type: HttpErrorResponseDto,
  })
  @ApiAuthErrors()
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @GetUser() authUser: any,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.changePassword(
      authUser.id,
      dto.currentPassword,
      dto.newPassword,
    );

    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: authUser.id,
      actorRole: authUser.role,
      action: 'PASSWORD_CHANGE',
      resource: 'user_profile',
      subjectId: authUser.id,
      result: 'SUCCESS',
    });

    return { message: 'Password updated successfully.' };
  }

  @Post('profile/photo')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('photo', { storage: profilePhotoStorage }))
  @ApiBearerAuth('JwtAuthGuard')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace profile photo' })
  @ApiOkResponse({
    description: 'Updated user profile with new photo.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid file upload.',
    type: HttpErrorResponseDto,
  })
  @ApiAuthErrors()
  async uploadProfilePhoto(
    @Req() req: AuthenticatedRequest,
    @GetUser() authUser: any,
    @UploadedFile(new FileValidationPipe()) file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.updateProfilePhoto(
      authUser.id,
      file,
    );

    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: authUser.id,
      actorRole: authUser.role,
      action: 'PROFILE_PHOTO_UPLOAD',
      resource: 'user_profile_photo',
      subjectId: authUser.id,
      result: 'SUCCESS',
    });

    return new UserResponseDto(updated as any);
  }

  @Delete('profile/photo')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Remove custom profile photo' })
  @ApiOkResponse({
    description: 'Profile photo removed.',
    type: UserResponseDto,
  })
  @ApiAuthErrors()
  async removeProfilePhoto(
    @Req() req: AuthenticatedRequest,
    @GetUser() authUser: any,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.removeProfilePhoto(authUser.id);

    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: authUser.id,
      actorRole: authUser.role,
      action: 'PROFILE_PHOTO_REMOVE',
      resource: 'user_profile_photo',
      subjectId: authUser.id,
      result: 'SUCCESS',
    });

    return new UserResponseDto(updated as any);
  }

  @Post('profile/link/google')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Link Google account to the current user' })
  @ApiOkResponse({
    description: 'Google account linked.',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid Google token.',
    type: HttpErrorResponseDto,
  })
  @ApiAuthErrors()
  async linkGoogleAccount(
    @Req() req: AuthenticatedRequest,
    @GetUser() authUser: any,
    @Body() dto: LinkGoogleDto,
  ): Promise<UserResponseDto> {
    const updated = await this.authService.linkGoogleAccount(
      authUser.id,
      dto.idToken,
    );

    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: authUser.id,
      actorRole: authUser.role,
      action: 'GOOGLE_LINK',
      resource: 'user_social_link',
      subjectId: authUser.id,
      result: 'SUCCESS',
    });

    return new UserResponseDto(updated as any);
  }

  @Post('profile/link/wallet')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JwtAuthGuard')
  @ApiOperation({ summary: 'Link Cardano wallet address to the current user' })
  @ApiOkResponse({ description: 'Wallet linked.', type: UserResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid wallet payload.',
    type: HttpErrorResponseDto,
  })
  @ApiAuthErrors()
  async linkWallet(
    @Req() req: AuthenticatedRequest,
    @GetUser() authUser: any,
    @Body() dto: LinkWalletDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.linkWalletAddress(
      authUser.id,
      dto.walletAddress,
    );

    this.audit.log({
      rid: (req as any)?.id || 'n/a',
      actorId: authUser.id,
      actorRole: authUser.role,
      action: 'WALLET_LINK',
      resource: 'user_wallet',
      subjectId: authUser.id,
      result: 'SUCCESS',
    });

    return new UserResponseDto(updated as any);
  }

  /**
   * Checks if the provided JWT token is valid and not expired.
   * Requires a valid JWT in the Authorization header.
   *
   * @returns {object} A success message if the token is valid.
   */
  @Get('check-token')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard) // Protect with JWT
  @ApiBearerAuth('JwtAuthGuard') // Document requirement
  @ApiOperation({ summary: 'Check if JWT token is valid' })
  @ApiOkResponse({ description: 'Token is valid.' })
  @ApiAuthErrors()
  checkTokenValidity(): { message: string } {
    // If the JwtAuthGuard passes, the token is valid.
    // The method body is only executed if the token is valid.
    this.logger.log('Token validity check successful.');
    return { message: 'Token is valid.' };
  }
}
