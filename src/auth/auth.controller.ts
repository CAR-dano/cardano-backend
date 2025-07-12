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
  Logger,
  HttpCode,
  InternalServerErrorException,
  UnauthorizedException, // Import UnauthorizedException
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
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

// Define interface for request object after JWT or Local auth guard runs
interface AuthenticatedRequest extends Request {
  user?: UserResponseDto; // Use UserResponseDto structure here
}

@ApiTags('Auth (UI Users)')
@Controller('auth') // Base path: /api/v1/auth
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

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
  ) {}

  /**
   * Handles local user registration (Email/Username + Password).
   *
   * @param registerUserDto - Contains email, username, password, name, walletAddress.
   * @returns {Promise<UserResponseDto>} The newly created user profile (excluding sensitive data).
   */
  @Post('register')
  @ApiOperation({ summary: 'Register a new user locally' })
  @ApiBody({ type: RegisterUserDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or Username already exists.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
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
  @HttpCode(HttpStatus.OK) // Return 200 OK on successful login
  @ApiOperation({
    summary: 'Login with local credentials (email/username + password)',
  })
  @ApiBody({ type: LoginUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful, JWT returned.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials.',
  })
  async loginLocal(
    @Req() req: AuthenticatedRequest, // Request now has req.user populated by LocalAuthGuard/LocalStrategy
    // @Body() loginUserDto: LoginUserDto // Body is implicitly used by LocalStrategy, no need to inject again unless needed explicitly
  ): Promise<LoginResponseDto> {
    if (!req.user) {
      // Ini seharusnya tidak terjadi jika guard bekerja, tapi tambahkan check untuk keamanan
      this.logger.error('LocalAuthGuard succeeded but req.user is missing!');
      throw new InternalServerErrorException('Authentication flow error.');
    }
    this.logger.log(
      `User logged in locally: ${req.user?.email ?? req.user?.username}`,
    );
    // req.user contains the validated user object returned by LocalStrategy.validate
    const { accessToken, refreshToken } = await this.authService.login(
      req.user as any,
    ); // Generate JWT
    return {
      accessToken,
      refreshToken,
      user: new UserResponseDto(req.user as any), // Cast req.user to User for DTO constructor
    };
  }

  /**
   * Handles inspector login using a PIN.
   * Uses ManualPinGuard to validate the PIN.
   * If successful, the guard attaches the user object to req.user.
   * Calls AuthService.login to generate JWT.
   *
   * @param req - The request object with user attached by ManualPinGuard.
   * @returns {Promise<LoginResponseDto>} JWT access token, refresh token, and user details.
   */
  @Post('login/inspector')
  @UseGuards(InspectorGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login for inspectors with PIN' })
  @ApiBody({ type: LoginInspectorDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful, JWT returned.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid PIN.',
  })
  async loginInspector(
    @Req() req: AuthenticatedRequest,
  ): Promise<LoginResponseDto> {
    if (!req.user) {
      this.logger.error('LocalPinAuthGuard succeeded but req.user is missing!');
      throw new InternalServerErrorException('Authentication flow error.');
    }
    this.logger.log(`Inspector logged in`);
    const { accessToken, refreshToken } = await this.authService.login(
      req.user as any,
    );
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
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain a new access token using a refresh token' })
  @ApiBearerAuth('jwt-refresh') // Specify the auth scheme for Swagger
  @ApiResponse({
    status: 200,
    description: 'New tokens generated successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (Invalid or expired refresh token).',
  })
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
  // @Get('google/callback')
  // @UseGuards(AuthGuard('google'))
  // @ApiExcludeEndpoint() // Typically hidden from public API docs
  // async googleAuthRedirect(
  //   @Req() req: AuthenticatedRequest,
  //   @Res() res: Response,
  // ) {
  //   // ... (Kode googleAuthRedirect tetap sama seperti sebelumnya, menggunakan req.user) ...
  //   this.logger.log('Received Google OAuth callback.');
  //   if (!req.user) {
  //     /* ... handle error redirect ... */ return res.redirect(/*...*/);
  //   }
  //   try {
  //     const { accessToken } = await this.authService.login(req.user);
  //     const clientUrl =
  //       this.configService.getOrThrow<string>('CLIENT_BASE_URL');
  //     res.redirect(`${clientUrl}/auth/callback?token=${accessToken}`); // Redirect with token
  //   } catch (error) {
  //     /* ... handle error redirect ... */ res.redirect(/*...*/);
  //   }
  // }

  /**
   * Logs out the user (primarily client-side for stateless JWT).
   * Requires a valid JWT.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard) // Protect this endpoint
  @ApiBearerAuth('JwtAuthGuard') // Document requirement
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successful (client should clear token).',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  async logout(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    this.logger.log(`User logged out: ${req.user?.email ?? req.user?.id}`);

    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    if (!token) {
      this.logger.warn('Logout failed: No token provided in request.');
      throw new UnauthorizedException('No token provided.');
    }

    try {
      // Decode the token to get its expiration time
      const decodedToken = this.jwtService.decode(token) as { exp: number };
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
  @UseGuards(JwtAuthGuard) // Protect with JWT
  @ApiBearerAuth('JwtAuthGuard') // Document requirement
  @ApiOperation({ summary: 'Get logged-in user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns authenticated user profile.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized.',
  })
  getProfile(@GetUser() user: UserResponseDto): UserResponseDto {
    // Use decorator to get user
    this.logger.log(`Profile requested for user: ${user.email ?? user.id}`);
    // The 'user' object here is already filtered by JwtStrategy/UserResponseDto structure
    return user;
  }

  /**
   * Checks if the provided JWT token is valid and not expired.
   * Requires a valid JWT in the Authorization header.
   *
   * @returns {object} A success message if the token is valid.
   */
  @Get('check-token')
  @UseGuards(JwtAuthGuard) // Protect with JWT
  @ApiBearerAuth('JwtAuthGuard') // Document requirement
  @ApiOperation({ summary: 'Check if JWT token is valid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized (token is invalid or expired).',
  })
  checkTokenValidity(): { message: string } {
    // If the JwtAuthGuard passes, the token is valid.
    // The method body is only executed if the token is valid.
    this.logger.log('Token validity check successful.');
    return { message: 'Token is valid.' };
  }

  // --- Placeholder Endpoints for Account Linking (Implement Later) ---

  // @Post('link/google')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('JwtAuthGuard')
  // @ApiOperation({ summary: 'Link Google Account to current user' })
  // async linkGoogle(/* ... receive google token/data ... */, @GetUser() user: UserResponseDto) {
  //   // Placeholder for linking a Google account to the current user.
  //   // It would typically involve verifying a Google token and updating the user's profile.
  //   // const googleProfile = await verifyGoogleToken(googleToken);
  //   // return this.usersService.linkGoogleAccount(user.id, googleProfile.id, googleProfile.email);
  // }

  // @Post('link/wallet')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('JwtAuthGuard')
  // @ApiOperation({ summary: 'Link Cardano Wallet to current user' })
  // @ApiBody({ type: LinkWalletDto }) // Assuming LinkWalletDto exists
  // async linkWallet(@Body() linkWalletDto: LinkWalletDto, @GetUser('id') userId: string) {
  //   // Placeholder for linking a Cardano wallet to the current user.
  //   // It would typically involve verifying the wallet address and updating the user's profile.
  //   // return this.usersService.linkWalletAddress(userId, linkWalletDto.walletAddress);
  // }

  // --- Placeholder Endpoint for Wallet Login (Implement Later) ---

  // @Post('login/wallet')
  // @UseGuards(WalletAuthGuard) // Use the (placeholder) wallet guard
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Login with Cardano Wallet Signature' })
  // @ApiBody({ type: LoginWalletDto })
  // async loginWallet(@Req() req: AuthenticatedRequest): Promise<LoginResponseDto> {
  //    // Placeholder for logging in with a Cardano wallet signature.
  //    // It would typically involve verifying the signature and generating a JWT.
  //    this.logger.log(`User logged in via wallet: ${req.user?.walletAddress}`);
  //    const { accessToken } = await this.authService.login(req.user);
  //    return { accessToken, user: new UserResponseDto(req.user as User) };
  // }
}
