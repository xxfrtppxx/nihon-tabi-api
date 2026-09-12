import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyStats(userId: string) {
    const [visitedRows, wantToGoRows, municipalities, prefectures] =
      await Promise.all([
        this.prisma.visit.findMany({
          where: { userId, status: 'visited' },
          select: { municipalityId: true },
          distinct: ['municipalityId'],
        }),
        this.prisma.visit.findMany({
          where: { userId, status: 'want_to_go' },
          select: { municipalityId: true },
          distinct: ['municipalityId'],
        }),
        this.prisma.municipality.findMany({
          select: { id: true, prefectureId: true },
        }),
        this.prisma.prefecture.findMany({ select: { id: true, region: true } }),
      ]);

    const visitedIds = new Set(visitedRows.map((r) => r.municipalityId));
    const wantToGoIds = new Set(
      wantToGoRows
        .map((r) => r.municipalityId)
        .filter((id) => !visitedIds.has(id)),
    );

    const regionByPrefectureId = new Map(
      prefectures.map((p) => [p.id, p.region]),
    );

    const byRegion = new Map<string, { visited: number; total: number }>();
    for (const municipality of municipalities) {
      const region = regionByPrefectureId.get(municipality.prefectureId) ?? 'unknown';
      const entry = byRegion.get(region) ?? { visited: 0, total: 0 };
      entry.total += 1;
      if (visitedIds.has(municipality.id)) {
        entry.visited += 1;
      }
      byRegion.set(region, entry);
    }

    const totalMunicipalities = municipalities.length;
    const visitedCount = visitedIds.size;

    return {
      visitedCount,
      wantToGoCount: wantToGoIds.size,
      totalMunicipalities,
      percentageVisited:
        totalMunicipalities > 0
          ? Number(((visitedCount / totalMunicipalities) * 100).toFixed(2))
          : 0,
      byRegion: Array.from(byRegion.entries()).map(([region, counts]) => ({
        region,
        ...counts,
      })),
    };
  }
}
