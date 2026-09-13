import { PartialType } from '@nestjs/mapped-types';
import { CreateTripDayDto } from './create-trip-day.dto';

export class UpdateTripDayDto extends PartialType(CreateTripDayDto) {}
