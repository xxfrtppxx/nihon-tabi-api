import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { ListVisitsQueryDto } from './dto/list-visits-query.dto';
import { PresignPhotoDto } from './dto/presign-photo.dto';

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class VisitsService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    this.bucket = this.config.get<string>('R2_BUCKET_NAME') ?? '';
    this.publicUrl = (this.config.get<string>('R2_PUBLIC_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

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
    const visit = await this.prisma.visit.create({
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
    if (visit.status === 'visited') {
      await this.pruneSupersededWantToGo(userId, visit.municipalityId, visit.visitedOn);
    }
    return visit;
  }

  async update(userId: string, visitId: string, dto: UpdateVisitDto) {
    await this.findOwnedVisit(userId, visitId);
    const visit = await this.prisma.visit.update({
      where: { id: visitId },
      data: {
        status: dto.status,
        visitedOn: dto.visitedOn ? new Date(dto.visitedOn) : undefined,
        note: dto.note,
        rating: dto.rating,
      },
      include: this.visitInclude,
    });
    if (visit.status === 'visited') {
      await this.pruneSupersededWantToGo(userId, visit.municipalityId, visit.visitedOn);
    }
    return visit;
  }

  // A "visited" entry supersedes any "want to go" plan for the same city
  // dated on or before it (or undated, since there's nothing to compare) —
  // the wish has been fulfilled, so it's cleared out automatically. A
  // "visited" entry saved with no date of its own counts as happening now,
  // so it supersedes every want-to-go for that city regardless of date.
  private async pruneSupersededWantToGo(
    userId: string,
    municipalityId: number,
    visitedOn: Date | null,
  ) {
    const superseded = await this.prisma.visit.findMany({
      where: {
        userId,
        municipalityId,
        status: 'want_to_go',
        ...(visitedOn
          ? { OR: [{ visitedOn: null }, { visitedOn: { lte: visitedOn } }] }
          : {}),
      },
      include: { photos: true },
    });
    if (superseded.length === 0) return;
    await this.prisma.visit.deleteMany({
      where: { id: { in: superseded.map((v) => v.id) } },
    });
    await Promise.all(
      superseded.flatMap((v) => v.photos.map((p) => this.deleteFromR2(p.url))),
    );
  }

  async remove(userId: string, visitId: string) {
    await this.findOwnedVisit(userId, visitId);
    const photos = await this.prisma.visitPhoto.findMany({
      where: { visitId },
    });
    await this.prisma.visit.delete({ where: { id: visitId } });
    await Promise.all(photos.map((photo) => this.deleteFromR2(photo.url)));
    return { success: true };
  }

  private async deleteFromR2(url: string) {
    if (!url.startsWith(`${this.publicUrl}/`)) return;
    const key = url.slice(this.publicUrl.length + 1);
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      console.error('Failed to delete R2 object', key, err);
    }
  }

  async presignPhoto(userId: string, visitId: string, dto: PresignPhotoDto) {
    await this.findOwnedVisit(userId, visitId);
    const extension = EXTENSION_BY_CONTENT_TYPE[dto.contentType];
    const key = `visits/${visitId}/${randomUUID()}.${extension}`;
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: dto.contentType,
      }),
      { expiresIn: 300 },
    );
    return { uploadUrl, publicUrl: `${this.publicUrl}/${key}` };
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
    await this.deleteFromR2(photo.url);
    return { success: true };
  }
}
