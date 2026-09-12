import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { PresignPhotoDto } from './dto/presign-photo.dto';
import { ListVisitsQueryDto } from './dto/list-visits-query.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get('visits')
  findAll(
    @CurrentUser() user: { userId: string },
    @Query() query: ListVisitsQueryDto,
  ) {
    return this.visitsService.findAll(user.userId, query);
  }

  @Post('visits')
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateVisitDto,
  ) {
    return this.visitsService.create(user.userId, dto);
  }

  @Patch('visits/:id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visitsService.update(user.userId, id, dto);
  }

  @Delete('visits/:id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.visitsService.remove(user.userId, id);
  }

  @Post('visits/:id/photos/presign')
  presignPhoto(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: PresignPhotoDto,
  ) {
    return this.visitsService.presignPhoto(user.userId, id, dto);
  }

  @Post('visits/:id/photos')
  addPhoto(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: AddPhotoDto,
  ) {
    return this.visitsService.addPhoto(user.userId, id, dto.url);
  }

  @Delete('photos/:id')
  removePhoto(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.visitsService.removePhoto(user.userId, id);
  }
}
