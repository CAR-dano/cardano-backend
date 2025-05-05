import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto'; // Import User DTO

export class LoginResponseDto {
  /**
   * The JSON Web Token (JWT) used for authenticating subsequent requests.
   * Include this token in the 'Authorization: Bearer <token>' header.
   */
  @ApiProperty({
    description: 'JWT access token for subsequent authenticated requests',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  /**
   * Details of the authenticated user (excluding sensitive information).
   */
  @ApiProperty({
    description: 'Authenticated user details',
    type: UserResponseDto, // Use the existing DTO for user details
  })
  user: UserResponseDto;
}
