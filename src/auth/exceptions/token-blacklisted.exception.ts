/*
 * --------------------------------------------------------------------------
 * File: token-blacklisted.exception.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Custom exception for blacklisted tokens.
 * This allows us to handle blacklisted tokens differently from other
 * authentication errors (e.g., log as WARN instead of ERROR).
 * --------------------------------------------------------------------------
 */

import { UnauthorizedException } from '@nestjs/common';

export class TokenBlacklistedException extends UnauthorizedException {
    constructor(message = 'Token has been invalidated') {
        super(message);
        this.name = 'TokenBlacklistedException';
    }
}
