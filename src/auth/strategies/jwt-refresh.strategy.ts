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
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const opts: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    };
    super(opts);
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
