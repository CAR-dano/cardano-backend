import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminDto {
  @ApiProperty({
    description: 'The username for the new user.',
    example: 'newadmin',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'The email address for the new user.',
    example: 'newadmin@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The password for the new user. Minimum 8 characters.',
    example: 'password123',
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'The role to assign to the new user.',
    enum: [Role.ADMIN, Role.SUPERADMIN],
    example: Role.ADMIN,
  })
  @IsIn([Role.ADMIN, Role.SUPERADMIN])
  @IsNotEmpty()
  role: Role;
}
