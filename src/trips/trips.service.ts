import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { CreateTripDayDto } from './dto/create-trip-day.dto';
import { UpdateTripDayDto } from './dto/update-trip-day.dto';

const EARTH_RADIUS_KM = 6371;

// Same great-circle formula the web app already uses client-side (for
// "nearby city" suggestions) — kept here too since the two run in
// different repos and this is the only place a trip's distance is derived.
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const tripInclude = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: { municipality: { include: { prefecture: true } } },
  },
} satisfies Prisma.TripInclude;

type TripWithDays = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.trip
      .findMany({
        where: { userId },
        include: tripInclude,
        orderBy: { createdAt: 'desc' },
      })
      .then((trips) => trips.map((trip) => this.withStats(trip)));
  }

  private async findOwnedTrip(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    if (trip.userId !== userId) {
      throw new ForbiddenException('You do not own this trip');
    }
    return trip;
  }

  async findOne(userId: string, tripId: string) {
    await this.findOwnedTrip(userId, tripId);
    const trip = await this.prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: tripInclude,
    });
    return this.withStats(trip);
  }

  async create(userId: string, dto: CreateTripDto) {
    if (dto.days?.length) {
      await this.assertMunicipalitiesExist(dto.days.map((d) => d.municipalityId));
    }
    try {
      const trip = await this.prisma.trip.create({
        data: {
          userId,
          title: dto.title,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          days: dto.days?.length
            ? {
                create: dto.days.map((d) => ({
                  dayNumber: d.dayNumber,
                  municipalityId: d.municipalityId,
                  note: d.note,
                })),
              }
            : undefined,
        },
        include: tripInclude,
      });
      return this.withStats(trip);
    } catch (err) {
      throw this.asConflict(err);
    }
  }

  async update(userId: string, tripId: string, dto: UpdateTripDto) {
    await this.findOwnedTrip(userId, tripId);
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        title: dto.title,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: tripInclude,
    });
    return this.withStats(trip);
  }

  async remove(userId: string, tripId: string) {
    await this.findOwnedTrip(userId, tripId);
    await this.prisma.trip.delete({ where: { id: tripId } });
    return { success: true };
  }

  async addDay(userId: string, tripId: string, dto: CreateTripDayDto) {
    await this.findOwnedTrip(userId, tripId);
    await this.assertMunicipalitiesExist([dto.municipalityId]);
    try {
      await this.prisma.tripDay.create({
        data: {
          tripId,
          dayNumber: dto.dayNumber,
          municipalityId: dto.municipalityId,
          note: dto.note,
        },
      });
    } catch (err) {
      throw this.asConflict(err);
    }
    return this.findOne(userId, tripId);
  }

  private async findOwnedDay(userId: string, tripId: string, dayId: string) {
    const day = await this.prisma.tripDay.findUnique({
      where: { id: dayId },
      include: { trip: true },
    });
    if (!day || day.tripId !== tripId) {
      throw new NotFoundException('Trip day not found');
    }
    if (day.trip.userId !== userId) {
      throw new ForbiddenException('You do not own this trip');
    }
    return day;
  }

  async updateDay(
    userId: string,
    tripId: string,
    dayId: string,
    dto: UpdateTripDayDto,
  ) {
    await this.findOwnedDay(userId, tripId, dayId);
    if (dto.municipalityId !== undefined) {
      await this.assertMunicipalitiesExist([dto.municipalityId]);
    }
    try {
      await this.prisma.tripDay.update({
        where: { id: dayId },
        data: {
          dayNumber: dto.dayNumber,
          municipalityId: dto.municipalityId,
          note: dto.note,
        },
      });
    } catch (err) {
      throw this.asConflict(err);
    }
    return this.findOne(userId, tripId);
  }

  async removeDay(userId: string, tripId: string, dayId: string) {
    await this.findOwnedDay(userId, tripId, dayId);
    await this.prisma.tripDay.delete({ where: { id: dayId } });
    return this.findOne(userId, tripId);
  }

  private async assertMunicipalitiesExist(ids: number[]) {
    const unique = Array.from(new Set(ids));
    const count = await this.prisma.municipality.count({
      where: { id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new NotFoundException('Municipality not found');
    }
  }

  // day_number is unique per trip (@@unique in the schema) so two days
  // can't collide — surface that as a normal 409 instead of a raw
  // Prisma error leaking out.
  private asConflict(err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException('A day with this number already exists in the trip');
    }
    return err;
  }

  // Distinct cities, day count, and total distance are derived from the
  // real day list on every read rather than stored, so editing/reordering
  // days can never leave them stale.
  private withStats(trip: TripWithDays) {
    const cityCount = new Set(trip.days.map((d) => d.municipalityId)).size;
    let totalKm = 0;
    for (let i = 1; i < trip.days.length; i++) {
      const a = trip.days[i - 1].municipality;
      const b = trip.days[i].municipality;
      if (
        a.centroidLat !== null &&
        a.centroidLng !== null &&
        b.centroidLat !== null &&
        b.centroidLng !== null
      ) {
        totalKm += haversineKm(
          { lat: a.centroidLat, lng: a.centroidLng },
          { lat: b.centroidLat, lng: b.centroidLng },
        );
      }
    }
    return {
      ...trip,
      cityCount,
      dayCount: trip.days.length,
      totalKm: Math.round(totalKm),
    };
  }
}
