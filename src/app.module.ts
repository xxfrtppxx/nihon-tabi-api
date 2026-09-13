import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GeoModule } from './geo/geo.module';
import { VisitsModule } from './visits/visits.module';
import { StatsModule } from './stats/stats.module';
import { TripsModule } from './trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'geo-data'),
      serveRoot: '/geo/files',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    GeoModule,
    VisitsModule,
    StatsModule,
    TripsModule,
  ],
})
export class AppModule {}
