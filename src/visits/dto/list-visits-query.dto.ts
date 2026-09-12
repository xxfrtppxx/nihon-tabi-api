import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { VisitStatus } from '@prisma/client';

export class ListVisitsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  prefectureId?: number;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;
}
