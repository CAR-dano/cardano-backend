import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: 'Optional updated email address for the user (must be unique)',
    example: 'updated.john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Optional updated username for the user (must be unique)',
    example: 'updated_johndoe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @ApiProperty({
    description: 'Optional updated full name of the user',
    example: 'John Doe Updated',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description:
      'Optional updated Cardano wallet address for the user (must be unique)',
    example: 'addr1q...xyz_updated',
    required: false,
  })
  @IsOptional()
  @IsString()
  walletAddress?: string;
}
