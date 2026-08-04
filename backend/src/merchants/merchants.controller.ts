import { Controller, Get, Query } from '@nestjs/common';
import { OkkoApiService } from '../okko/okko-api.service';
import { ShellApiService } from '../shell/shell-api.service';

@Controller('api/merchants')
export class MerchantsController {
  constructor(
    private readonly okkoApiService: OkkoApiService,
    private readonly shellApiService: ShellApiService,
  ) {}

  @Get()
  async getAllMerchants(
    @Query('brand') brand?: string,
    @Query('page') pageStr?: string,
    @Query('size') sizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const size = Math.max(1, parseInt(sizeStr || '12', 10));

    let okkoMerchants: any[] = [];
    let shellMerchants: any[] = [];

    if (brand !== 'SHELL') {
      okkoMerchants = await this.okkoApiService.getMerchants();
    }
    if (brand !== 'OKKO') {
      shellMerchants = await this.shellApiService.getShellMerchants();
    }

    const combined = [...okkoMerchants, ...shellMerchants];
    const total = combined.length;
    const startIndex = (page - 1) * size;
    const items = combined.slice(startIndex, startIndex + size);

    return {
      items,
      total,
      page,
      size,
      totalPages: Math.ceil(total / size) || 1
    };
  }
}
