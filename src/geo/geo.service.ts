import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPrefectures() {
    const prefectures = await this.prisma.prefecture.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { municipalities: true } } },
    });
    return prefectures.map(({ _count, ...prefecture }) => ({
      ...prefecture,
      municipalityCount: _count.municipalities,
    }));
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
