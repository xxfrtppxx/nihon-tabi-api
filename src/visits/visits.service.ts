import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { ListVisitsQueryDto } from './dto/list-visits-query.dto';

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly visitInclude = {
    photos: true,
    municipality: { include: { prefecture: true } },
  } as const;

  findAll(userId: string, query: ListVisitsQueryDto) {
    return this.prisma.visit.findMany({
      where: {
        userId,
        status: query.status,
        municipality: query.prefectureId
          ? { prefectureId: query.prefectureId }
          : undefined,
      },
      include: this.visitInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOwnedVisit(userId: string, visitId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
    });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    if (visit.userId !== userId) {
      throw new ForbiddenException('You do not own this visit');
    }
    return visit;
  }

  async create(userId: string, dto: CreateVisitDto) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: dto.municipalityId },
    });
    if (!municipality) {
      throw new NotFoundException('Municipality not found');
    }
    return this.prisma.visit.create({
      data: {
        userId,
        municipalityId: dto.municipalityId,
        status: dto.status,
        visitedOn: dto.visitedOn ? new Date(dto.visitedOn) : undefined,
        note: dto.note,
        rating: dto.rating,
      },
      include: this.visitInclude,
    });
  }

  async update(userId: string, visitId: string, dto: UpdateVisitDto) {
    await this.findOwnedVisit(userId, visitId);
    return this.prisma.visit.update({
      where: { id: visitId },
      data: {
        status: dto.status,
        visitedOn: dto.visitedOn ? new Date(dto.visitedOn) : undefined,
        note: dto.note,
        rating: dto.rating,
      },
      include: this.visitInclude,
    });
  }

  async remove(userId: string, visitId: string) {
    await this.findOwnedVisit(userId, visitId);
    await this.prisma.visit.delete({ where: { id: visitId } });
    return { success: true };
  }

  async addPhoto(userId: string, visitId: string, url: string) {
    await this.findOwnedVisit(userId, visitId);
    return this.prisma.visitPhoto.create({
      data: { visitId, url },
    });
  }

  async removePhoto(userId: string, photoId: string) {
    const photo = await this.prisma.visitPhoto.findUnique({
      where: { id: photoId },
      include: { visit: true },
    });
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }
    if (photo.visit.userId !== userId) {
      throw new ForbiddenException('You do not own this photo');
    }
    await this.prisma.visitPhoto.delete({ where: { id: photoId } });
    return { success: true };
  }
}
