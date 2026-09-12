import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateVisitDto } from './create-visit.dto';

export class UpdateVisitDto extends PartialType(
  OmitType(CreateVisitDto, ['municipalityId'] as const),
) {}
