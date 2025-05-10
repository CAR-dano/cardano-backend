import { ApiProperty } from '@nestjs/swagger';

export class InspectionBranchCityResponseDto {
  @ApiProperty({
    example: 'cuid',
    description: 'Unique identifier of the inspection branch city',
  })
  id: string;

  @ApiProperty({ example: 'Jakarta', description: 'Name of the city' })
  city: string;

  @ApiProperty({
    example: 'Main Branch',
    description: 'Name of the inspection branch',
  })
  code: string;

  @ApiProperty({
    example: '2023-10-27T10:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-10-27T10:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
