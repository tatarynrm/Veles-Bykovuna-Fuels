import { Controller, Get, Post } from '@nestjs/common';
import { GpsSyncService } from './gps-sync.service';

@Controller('api/gps')
export class GpsController {
  constructor(private readonly gpsSync: GpsSyncService) {}

  /** Config + whether a cycle is currently running. */
  @Get('status')
  getStatus() {
    return this.gpsSync.getStatus();
  }

  /** Live per-vehicle sync progress for the realtime-coordinates page (poll this). */
  @Get('progress')
  getProgress() {
    return this.gpsSync.getProgress();
  }

  /**
   * Manually run one full pass (all vehicles). Handy for the first backfill and for
   * debugging. Writes to the live Oracle DB, so the global ReadOnlyGuard blocks it
   * for the guest role. No-op unless GPS_SYNC_ENABLED=true.
   */
  @Post('sync')
  sync() {
    return this.gpsSync.runCycle();
  }
}
