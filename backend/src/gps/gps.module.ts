import { Module } from '@nestjs/common';
import { OracleModule } from '../oracle/oracle.module';
import { RuptelaModule } from '../ruptela/ruptela.module';
import { GpsSyncService } from './gps-sync.service';
import { GpsRepository } from './gps.repository';
import { GpsController } from './gps.controller';

@Module({
  imports: [OracleModule, RuptelaModule],
  controllers: [GpsController],
  providers: [GpsSyncService, GpsRepository],
})
export class GpsModule {}
