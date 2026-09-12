import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { VisitStatus } from '@prisma/client';

export class CreateVisitDto {
  @Type(() => Number)
  @IsInt()
  municipalityId: number;

  @IsEnum(VisitStatus)
  status: VisitStatus;

  @IsOptional()
  @IsDateString()
  visitedOn?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
