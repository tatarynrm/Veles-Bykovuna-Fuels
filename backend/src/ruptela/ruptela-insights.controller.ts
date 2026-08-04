import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RuptelaInsightsService } from './ruptela-insights.service';

const toInt = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};

/**
 * Thin 1:1 surface over RuptelaInsightsService. Every route mirrors one FMS
 * endpoint; naming follows the vendor's, so the swagger spec doubles as the
 * documentation for this controller.
 */
@Controller('api/ruptela/insights')
export class RuptelaInsightsController {
  constructor(private readonly insights: RuptelaInsightsService) {}

  /* ── fuel events ── */

  @Get('fuel-events')
  fuelEvents(
    @Query('objectId') objectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('token') token?: string,
  ) {
    return this.insights.getFuelEvents(objectId, from, to, toInt(limit), token);
  }

  /* ── detected events ── */

  @Get('detected-events')
  detectedEvents(
    @Query('objectId') objectId?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('token') token?: string,
  ) {
    return this.insights.getDetectedEvents({
      objectId,
      userId,
      from,
      to,
      limit: toInt(limit),
      token,
    });
  }

  /* ── ecodriving ── */

  @Get('ecodriving/object/:id')
  ecodrivingObject(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.insights.getEcodriving('object', id, from, to);
  }

  @Get('ecodriving/driver/:id')
  ecodrivingDriver(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.insights.getEcodriving('driver', id, from, to);
  }

  /* ── drivers ── */

  @Get('drivers')
  drivers(
    @Query('limit') limit?: string,
    @Query('token') token?: string,
    @Query('identifier') identifier?: string,
    @Query('identifierType') identifierType?: string,
  ) {
    return this.insights.getDrivers(toInt(limit), token, identifier, identifierType);
  }

  @Get('drivers/:id')
  driver(@Param('id') id: string) {
    return this.insights.getDriver(id);
  }

  @Get('drivers/:id/states')
  driverStates(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('token') token?: string,
  ) {
    return this.insights.getDriverStates(id, from, to, toInt(limit), token);
  }

  @Get('drivers/:id/time-analysis')
  driverTimeAnalysis(@Param('id') id: string) {
    return this.insights.getDriverTimeAnalysis(id);
  }

  @Get('assignations/last')
  lastAssignation(
    @Query('driverId') driverId?: string,
    @Query('objectId') objectId?: string,
  ) {
    return this.insights.getLastAssignation(driverId, objectId);
  }

  @Post('assignations')
  createAssignation(@Body() body: unknown) {
    return this.insights.createAssignation(body);
  }

  /* ── geozones ── */

  @Get('geozones')
  geozones(
    @Query('geometry') geometry?: string,
    @Query('limit') limit?: string,
    @Query('token') token?: string,
  ) {
    return this.insights.getGeozones(geometry === '1' || geometry === 'true', toInt(limit), token);
  }

  @Post('geozones/visits')
  geozoneVisits(@Body() body: any) {
    return this.insights.findGeozoneVisits(body ?? {});
  }

  /* ── country report ── */

  @Get('countries/object/:id')
  countriesByObject(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('token') token?: string,
  ) {
    return this.insights.getCountries('object', id, from, to, toInt(limit), token);
  }

  @Get('countries/driver/:id')
  countriesByDriver(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('token') token?: string,
  ) {
    return this.insights.getCountries('driver', id, from, to, toInt(limit), token);
  }

  /* ── coordinates history ── */

  @Get('coordinates/:objectId')
  coordinates(
    @Param('objectId') objectId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('token') token?: string,
    @Query('geozones') geozones?: string,
  ) {
    return this.insights.getCoordinatesHistory(
      objectId,
      from,
      to,
      toInt(limit),
      token,
      geozones === '1' || geozones === 'true',
    );
  }

  @Get('coordinates/:objectId/at/:datetime')
  coordinateAt(@Param('objectId') objectId: string, @Param('datetime') datetime: string) {
    return this.insights.getCoordinateAt(objectId, datetime);
  }

  /* ── registries ── */

  @Get('object-groups')
  objectGroups(@Query('limit') limit?: string, @Query('token') token?: string) {
    return this.insights.getObjectGroups(toInt(limit), token);
  }

  @Get('object-groups/:id')
  objectGroup(@Param('id') id: string) {
    return this.insights.getObjectGroup(id);
  }

  @Put('object-groups/:id')
  updateObjectGroup(@Param('id') id: string, @Body() body: unknown) {
    return this.insights.updateObjectGroup(id, body);
  }

  @Get('users')
  users(@Query('limit') limit?: string, @Query('token') token?: string) {
    return this.insights.getUsers(toInt(limit), token);
  }

  /* ── driver violations ── */

  @Post('driver-violations')
  driverViolations(@Body() body: any) {
    return this.insights.findDriverViolations(body ?? {});
  }

  /* ── client events CRUD ── */

  @Get('events')
  events(@Query('limit') limit?: string, @Query('token') token?: string) {
    return this.insights.getEvents(toInt(limit), token);
  }

  @Get('events/:id')
  event(@Param('id') id: string) {
    return this.insights.getEvent(id);
  }

  @Post('events')
  createEvent(@Body() body: unknown) {
    return this.insights.createEvent(body);
  }

  @Put('events/:id')
  updateEvent(@Param('id') id: string, @Body() body: unknown) {
    return this.insights.updateEvent(id, body);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) {
    return this.insights.deleteEvent(id);
  }

  /* ── share links ── */

  @Get('share-links')
  shareLinks(@Query('limit') limit?: string, @Query('token') token?: string) {
    return this.insights.getShareLinks(toInt(limit), token);
  }

  @Post('share-links')
  createShareLink(@Body() body: any) {
    return this.insights.createShareLink(body);
  }

  @Put('share-links/:id')
  updateShareLink(@Param('id') id: string, @Body() body: unknown) {
    return this.insights.updateShareLink(id, body);
  }

  @Delete('share-links/:id')
  deleteShareLink(@Param('id') id: string) {
    return this.insights.deleteShareLink(id);
  }

  /* ── driver management ── */

  @Post('management/drivers')
  createDriver(@Body() body: unknown) {
    return this.insights.createDriver(body);
  }

  @Get('management/drivers/:id')
  managedDriver(@Param('id') id: string) {
    return this.insights.getManagedDriver(id);
  }

  @Put('management/drivers/:id')
  updateDriver(@Param('id') id: string, @Body() body: unknown) {
    return this.insights.updateDriver(id, body);
  }

  @Delete('management/drivers/:id')
  deleteDriver(@Param('id') id: string) {
    return this.insights.deleteDriver(id);
  }

  /* ── tachograph ── */

  @Post('tacho/requests')
  tachoRequests(@Body() body: unknown) {
    return this.insights.findTachoRequests(body);
  }

  @Get('tacho/request/:id')
  tachoRequest(@Param('id') id: string) {
    return this.insights.getTachoRequest(id);
  }

  @Post('tacho/driver-card-download')
  tachoDriverDownload(@Body() body: unknown) {
    return this.insights.scheduleDriverCardDownload(body);
  }

  @Post('tacho/vehicle-download')
  tachoVehicleDownload(@Body() body: unknown) {
    return this.insights.scheduleVehicleDownload(body);
  }

  @Delete('tacho/request/:id')
  deleteTachoRequest(@Param('id') id: string) {
    return this.insights.deleteTachoRequest(id);
  }

  @Get('tacho/file/:id')
  async tachoFile(@Param('id') id: string, @Res() res: Response) {
    const file = await this.insights.downloadTachoFile(id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  /* ── integrations ── */

  @Get('sentgeo/:objectId')
  sentgeo(@Param('objectId') objectId: string) {
    return this.insights.getSentGeoStatus(objectId);
  }
}
