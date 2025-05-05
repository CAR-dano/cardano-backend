import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginUserDto {
  /**
   * The user's registered email address OR username used for login.
   * Required for login.
   * @example "newuser@example.com" or "newuser123"
   */
  @ApiProperty({
    description: "User's email address OR username",
    example: 'user@example.com',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  loginIdentifier: string; // Use a generic name to accept email or username

  /**
   * The user's password.
   * Required for login.
   * @example "P@sswOrd123!"
   */
  @ApiProperty({
    description: "User's password",
    example: 'P@sswOrd123!',
    required: true,
    type: String,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
