import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  NovaPoshtaApiService,
  CreateShipmentInput,
} from './novaposhta-api.service';

@Controller('api/novaposhta')
export class NovaPoshtaController {
  constructor(private readonly novaposhta: NovaPoshtaApiService) {}

  @Get('status')
  getStatus() {
    return this.novaposhta.getStatus();
  }

  /**
   * Track one or more parcels. Accepts a comma-separated `numbers` list, with an
   * optional single `phone` applied to all of them (Nova Poshta returns fuller
   * data when the parcel's phone matches).
   */
  @Get('track')
  track(@Query('numbers') numbers?: string, @Query('phone') phone?: string) {
    const list = (numbers ?? '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((number) => ({ number, phone }));
    return this.novaposhta.track(list);
  }

  /** The account's own register of created waybills, by date range. */
  @Get('shipments')
  listShipments(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.novaposhta.listShipments({
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('cities')
  searchCities(@Query('find') find?: string, @Query('limit') limit?: string) {
    return this.novaposhta.searchCities(find ?? '', limit ? Number(limit) : 20);
  }

  @Get('warehouses')
  listWarehouses(
    @Query('cityRef') cityRef: string,
    @Query('find') find?: string,
    @Query('limit') limit?: string,
  ) {
    return this.novaposhta.listWarehouses(
      cityRef,
      find,
      limit ? Number(limit) : 50,
    );
  }

  /** Sender resolved from the API key — pre-fills the create form. */
  @Get('sender')
  getSender() {
    return this.novaposhta.resolveSender();
  }

  /**
   * Create an express waybill. Writes to Nova Poshta's live account, so the
   * global ReadOnlyGuard blocks this for the guest role.
   */
  @Post('shipments')
  createShipment(
    @Body()
    body: CreateShipmentInput & {
      senderCityRef: string;
      senderWarehouseRef: string;
    },
  ) {
    return this.novaposhta.createShipment(
      body,
      body.senderCityRef,
      body.senderWarehouseRef,
    );
  }
}
