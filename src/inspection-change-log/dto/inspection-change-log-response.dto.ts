import { ApiProperty } from '@nestjs/swagger';

export class InspectionChangeLogResponseDto {
  @ApiProperty({ description: 'The unique identifier of the change log entry' })
  id: string;

  @ApiProperty({
    description: 'The ID of the inspection the change log belongs to',
  })
  inspectionId: string;

  @ApiProperty({ description: 'The name of the field that was changed' })
  fieldName: string;

  @ApiProperty({ description: 'The old value of the field' })
  oldValue: string;

  @ApiProperty({ description: 'The new value of the field' })
  newValue: string;

  @ApiProperty({ description: 'The timestamp when the change occurred' })
  changedAt: Date;
}
