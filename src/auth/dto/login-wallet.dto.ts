import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginWalletDto {
  /**
   * The user's Cardano wallet address used for login/authentication.
   * Required for wallet login.
   * @example "addr1qx2k8q9p5z4z..."
   */
  @ApiProperty({
    description: 'Cardano wallet address used for login',
    example: 'addr1qx2k8q9p5z4z...',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  /**
   * A message signed by the user's wallet to prove ownership.
   * The backend needs to verify this signature against the walletAddress.
   * Required for wallet login.
   * @example "0xabcdef123456..."
   */
  @ApiProperty({
    description:
      "Data signature generated by the user's wallet to prove ownership",
    example: '{"signature": "...", "key": "..."}', // Example structure might vary
    required: true,
  })
  @IsString() // Or IsObject if you expect a structured signature object
  @IsNotEmpty()
  signature: string; // The actual type/structure depends heavily on the signing library/method
}
