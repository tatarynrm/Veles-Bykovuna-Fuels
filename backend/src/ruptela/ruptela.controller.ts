import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { RuptelaApiService } from './ruptela-api.service';
import {
  RuptelaRoutingService,
  CreateTripInput,
  UpdateTripInput,
  TripScope,
  TripState,
  TripSortKey,
  ACTIVE_STATES,
  ARCHIVE_STATES,
} from './ruptela-routing.service';

@Controller('api/ruptela')
export class RuptelaController {
  constructor(
    /** Telemetry: /objects-last-coordinate, /objects/{id}/… */
    private readonly ruptelaService: RuptelaApiService,
    /** Routing & Tasking: the /routing GraphQL endpoint. */
    private readonly routingService: RuptelaRoutingService,
  ) {}

  /* ── telemetry ──────────────────────────────────────────────────────── */

  @Get('status')
  getStatus() {
    return this.ruptelaService.getApiStatus();
  }

  @Get('vehicles')
  getVehicles() {
    return this.ruptelaService.getVehicles();
  }

  @Get('vehicles/:objectId/trips')
  getVehicleTripHistory(
    @Param('objectId') objectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ruptelaService.getVehicleTripHistory(objectId, from, to);
  }

  /* ── routing & tasking ──────────────────────────────────────────────── */

  @Get('routing/status')
  getRoutingStatus() {
    return this.routingService.getStatus();
  }

  /**
   * `scope=active` (default) is the fast path — six live states, ~4s cold and
   * served from a warm cache in practice. `scope=archive` pulls COMPLETED and
   * CANCELED, which is a ~30s upstream query, so it is only fetched when asked
   * for and then cached for 15 minutes.
   */
  @Get('trips')
  listTrips(
    @Query('scope') scope?: string,
    /** Comma-separated TripState list, e.g. `states=NEW,IN_PROGRESS`. */
    @Query('states') states?: string,
    @Query('q') q?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    const allowedScopes: TripScope[] = ['active', 'archive', 'all'];
    const allowedSorts: TripSortKey[] = [
      'default',
      'departure',
      'eta',
      'title',
      'distance',
      'state',
    ];
    const knownStates = new Set<string>([...ACTIVE_STATES, ...ARCHIVE_STATES]);

    const parsedStates = (states ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is TripState => knownStates.has(s));

    return this.routingService.listTrips({
      scope: allowedScopes.includes(scope as TripScope) ? (scope as TripScope) : 'active',
      states: parsedStates.length > 0 ? parsedStates : undefined,
      q,
      vehicleId,
      driverId,
      from,
      to,
      sort: allowedSorts.includes(sort as TripSortKey) ? (sort as TripSortKey) : 'default',
      order: order === 'desc' ? 'desc' : 'asc',
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    });
  }

  @Get('trips/:id')
  getTrip(@Param('id') id: string) {
    return this.routingService.getTrip(id);
  }

  @Post('trips')
  createTrip(@Body() body: CreateTripInput) {
    return this.routingService.createTrip(body);
  }

  @Put('trips/:id')
  updateTrip(@Param('id') id: string, @Body() body: UpdateTripInput) {
    return this.routingService.updateTrip(id, body);
  }

  @Delete('trips/:id')
  deleteTrip(@Param('id') id: string) {
    return this.routingService.deleteTrip(id);
  }

  @Get('tasks')
  listTasks(@Query('tripId') tripId?: string) {
    return this.routingService.listTasks(tripId);
  }

  /** Local dispatcher flag — Ruptela exposes no todo-completion mutation. */
  @Patch('trips/:tripId/tasks/:taskId')
  setTaskCompleted(
    @Param('tripId') tripId: string,
    @Param('taskId') taskId: string,
    @Body() body: { completed: boolean },
  ) {
    return this.routingService.setTaskCompleted(tripId, taskId, body.completed);
  }
}
