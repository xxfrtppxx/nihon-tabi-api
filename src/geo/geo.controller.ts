import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('prefectures')
  findAllPrefectures() {
    return this.geoService.findAllPrefectures();
  }

  @Get('prefectures/:id/municipalities')
  findMunicipalities(@Param('id', ParseIntPipe) id: number) {
    return this.geoService.findMunicipalitiesByPrefecture(id);
  }
}
