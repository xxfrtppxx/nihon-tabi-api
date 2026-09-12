import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  findAllPrefectures() {
    return this.prisma.prefecture.findMany({ orderBy: { id: 'asc' } });
  }

  async findMunicipalitiesByPrefecture(prefectureId: number) {
    const prefecture = await this.prisma.prefecture.findUnique({
      where: { id: prefectureId },
    });
    if (!prefecture) {
      throw new NotFoundException('Prefecture not found');
    }
    return this.prisma.municipality.findMany({
      where: { prefectureId },
      orderBy: { id: 'asc' },
    });
  }
}
