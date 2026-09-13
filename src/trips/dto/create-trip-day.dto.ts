import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTripDayDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dayNumber: number;

  @Type(() => Number)
  @IsInt()
  municipalityId: number;

  @IsOptional()
  @IsString()
  note?: string;
}
