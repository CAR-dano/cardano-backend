/*
 * --------------------------------------------------------------------------
 * File: jwt-refresh.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Implements the Passport.js strategy for validating JWT refresh tokens.
 * --------------------------------------------------------------------------
 */
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import * as bcrypt from 'bcrypt';
import { VaultConfigService } from '../../config/vault-config.service';

@Injectable()
export class JwtRefreshStrategy
  extends PassportStrategy(Strategy, 'jwt-refresh')
  implements OnModuleInit
{
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly vaultConfigService: VaultConfigService,
  ) {
    const opts: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') ||
        'placeholder-refresh-secret',
      passReqToCallback: true,
    };
    super(opts);
  }

  /**
   * After module init, update the secret key from Vault if available.
   */
  async onModuleInit(): Promise<void> {
    try {
      const secrets = await this.vaultConfigService.getSecrets();
      const refreshSecret =
        secrets.JWT_REFRESH_SECRET ||
        this.configService.get<string>('JWT_REFRESH_SECRET');
      if (refreshSecret) {
        // Patch the internal secret used by passport-jwt's jsonwebtoken

        (this as any)._secretOrKey = refreshSecret;
      }
    } catch {
      // Non-fatal — will continue with env value set during construction
    }
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.get('Authorization')?.replace('Bearer', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token malformed');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    const isRefreshTokenMatching = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!isRefreshTokenMatching) {
      throw new UnauthorizedException('Access Denied');
    }

    // The user object from the payload is returned, which will be attached to req.user
    return user;
  }
}
