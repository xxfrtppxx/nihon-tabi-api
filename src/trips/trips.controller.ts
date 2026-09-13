import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { CreateTripDayDto } from './dto/create-trip-day.dto';
import { UpdateTripDayDto } from './dto/update-trip-day.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('trips')
  findAll(@CurrentUser() user: { userId: string }) {
    return this.tripsService.findAll(user.userId);
  }

  @Get('trips/:id')
  findOne(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.tripsService.findOne(user.userId, id);
  }

  @Post('trips')
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.userId, dto);
  }

  @Patch('trips/:id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.update(user.userId, id, dto);
  }

  @Delete('trips/:id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.tripsService.remove(user.userId, id);
  }

  @Post('trips/:id/days')
  addDay(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: CreateTripDayDto,
  ) {
    return this.tripsService.addDay(user.userId, id, dto);
  }

  @Patch('trips/:id/days/:dayId')
  updateDay(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: UpdateTripDayDto,
  ) {
    return this.tripsService.updateDay(user.userId, id, dayId, dto);
  }

  @Delete('trips/:id/days/:dayId')
  removeDay(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('dayId') dayId: string,
  ) {
    return this.tripsService.removeDay(user.userId, id, dayId);
  }
}
