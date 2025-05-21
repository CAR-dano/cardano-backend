import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IdentityDetailsDto {
  @ApiProperty({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspector.',
  })
  @IsUUID()
  namaInspektor: string; // This will hold the inspectorId UUID

  @ApiProperty({
    example: 'Maul',
    description: 'The name of the customer.',
  })
  @IsString()
  namaCustomer: string;

  @ApiProperty({
    example: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    description: 'The UUID of the inspection branch city.',
  })
  @IsUUID()
  cabangInspeksi: string; // This will hold the branchCityId UUID
}
