import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateInspectorDto {
  @ApiProperty({
    description: 'Email address of the inspector (must be unique)',
    example: 'inspector.john.doe@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Username for the inspector (must be unique)',
    example: 'inspector_johndoe',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    description: 'Full name of the inspector',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description:
      'Optional Cardano wallet address for the inspector (must be unique)',
    example: 'addr1q...xyz',
    required: false,
  })
  @IsOptional()
  @IsString()
  walletAddress?: string;
}
