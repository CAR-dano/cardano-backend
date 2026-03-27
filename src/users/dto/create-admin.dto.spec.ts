/*
 * --------------------------------------------------------------------------
 * File: create-admin.dto.spec.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for CreateAdminDto password policy and field
 * validation. Uses class-validator + class-transformer to simulate the
 * ValidationPipe behaviour.
 * --------------------------------------------------------------------------
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Role } from '@prisma/client';
import { CreateAdminDto } from './create-admin.dto';

/**
 * Build a CreateAdminDto instance from a plain object, then run class-validator.
 */
async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateAdminDto, plain);
  return validate(dto);
}

describe('CreateAdminDto – password policy', () => {
  const validBase = {
    email: 'admin@example.com',
    username: 'adminuser',
    name: 'Admin User',
    password: 'P@ssw0rd!123',
    role: Role.ADMIN,
  };

  // ─── Valid passwords ──────────────────────────────────────────────────────

  it('should pass with a 12-char complex password', async () => {
    const errors = await validateDto({
      ...validBase,
      password: 'P@ssw0rd!123',
    });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors).toHaveLength(0);
  });

  it('should pass with a longer complex password', async () => {
    const errors = await validateDto({
      ...validBase,
      password: 'MyStr0ng!Password#2025',
    });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors).toHaveLength(0);
  });

  it('should pass with 72-char password (bcrypt limit)', async () => {
    const pwd = 'P@ssw0rd!123' + 'a'.repeat(60); // 72 chars
    const errors = await validateDto({ ...validBase, password: pwd });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors).toHaveLength(0);
  });

  // ─── Too short ────────────────────────────────────────────────────────────

  it('should fail when password is shorter than 12 chars', async () => {
    const errors = await validateDto({ ...validBase, password: 'P@ss0rd!' }); // 8 chars
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  it('should fail when password is exactly 11 chars (one below minimum)', async () => {
    const errors = await validateDto({ ...validBase, password: 'P@ssw0rd!12' }); // 11 chars
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  // ─── Too long ─────────────────────────────────────────────────────────────

  it('should fail when password exceeds 72 chars', async () => {
    const pwd = 'P@ssw0rd!123' + 'a'.repeat(61); // 73 chars
    const errors = await validateDto({ ...validBase, password: pwd });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  // ─── Missing complexity requirements ─────────────────────────────────────

  it('should fail when password has no uppercase letter', async () => {
    const errors = await validateDto({
      ...validBase,
      password: 'p@ssw0rd!123',
    });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  it('should fail when password has no lowercase letter', async () => {
    const errors = await validateDto({
      ...validBase,
      password: 'P@SSW0RD!123',
    });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  it('should fail when password has no digit', async () => {
    const errors = await validateDto({
      ...validBase,
      password: 'P@ssword!abc',
    });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  it('should fail when password has no special character', async () => {
    const errors = await validateDto({
      ...validBase,
      password: 'Passw0rdAbcd',
    });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  // ─── Empty / missing ──────────────────────────────────────────────────────

  it('should fail when password is empty', async () => {
    const errors = await validateDto({ ...validBase, password: '' });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  it('should fail when password is missing', async () => {
    const { password: _omit, ...noPassword } = validBase;
    const errors = await validateDto(noPassword);
    const pwdErrors = errors.filter((e) => e.property === 'password');
    expect(pwdErrors.length).toBeGreaterThan(0);
  });

  // ─── Error message content ────────────────────────────────────────────────

  it('should include the correct message when complexity is not met', async () => {
    const errors = await validateDto({
      ...validBase,
      password: 'allowercase123!',
    });
    const pwdErrors = errors.filter((e) => e.property === 'password');
    const messages = pwdErrors.flatMap((e) =>
      Object.values(e.constraints ?? {}),
    );
    expect(messages.some((m) => /uppercase/i.test(m))).toBe(true);
  });

  it('should include the minimum length message when too short', async () => {
    const errors = await validateDto({ ...validBase, password: 'P@s1' }); // 4 chars
    const pwdErrors = errors.filter((e) => e.property === 'password');
    const messages = pwdErrors.flatMap((e) =>
      Object.values(e.constraints ?? {}),
    );
    expect(messages.some((m) => /12/.test(m))).toBe(true);
  });
});
