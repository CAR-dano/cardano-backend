/*
 * --------------------------------------------------------------------------
 * File: jwt-refresh.guard.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Auth guard for the JWT refresh strategy.
 * --------------------------------------------------------------------------
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
