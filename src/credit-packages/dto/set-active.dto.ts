import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetActiveDto {
  @ApiProperty({ description: 'Target active state', example: true })
  @IsBoolean()
  isActive!: boolean;
}

