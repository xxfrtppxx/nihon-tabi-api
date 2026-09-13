import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTripDto } from './create-trip.dto';

// Days are managed through their own endpoints (POST/PATCH/DELETE
// trips/:id/days/...), not by resending the whole itinerary here.
export class UpdateTripDto extends PartialType(
  OmitType(CreateTripDto, ['days'] as const),
) {}
