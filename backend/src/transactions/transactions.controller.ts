import { Controller, Get, Query, Param } from '@nestjs/common';
import { OkkoApiService } from '../okko/okko-api.service';
import { ShellApiService } from '../shell/shell-api.service';

@Controller('api/transactions')
export class TransactionsController {
  constructor(
    private readonly okkoApiService: OkkoApiService,
    private readonly shellApiService: ShellApiService,
  ) {}

  @Get()
  async getAllTransactions(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('brand') brand?: string,
    @Query('trans_type') transType?: string,
    @Query('page') pageStr?: string,
    @Query('size') sizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const size = Math.max(1, parseInt(sizeStr || '10', 10));

    let okkoTx: any[] = [];
    let shellTx: any[] = [];

    if (brand !== 'SHELL') {
      okkoTx = await this.okkoApiService.getTransactions(dateFrom, dateTo);
    }
    if (brand !== 'OKKO') {
      const rawShell = await this.shellApiService.getPricedTransactions(dateFrom, dateTo);
      shellTx = rawShell.map(t => ({
        trans_id: t.TransactionId,
        trans_date: t.TransactionDate,
        contract_id: 'SHELL-GB00000001',
        contract_name: 'Shell Mobility Account',
        client_id: 'LLC Nikaautotrans',
        client_name: t.DriverName || 'Shell Driver',
        card_num: t.CardPAN,
        azs_name: t.SiteName,
        addr_name: `${t.SiteName} (${t.SiteCountry})`,
        product_id: t.ProductCode,
        product_desc: t.ProductName,
        price: t.UnitPrice,
        volume: t.Quantity,
        amnt_trans: t.GrossAmount,
        amount_discount: 0,
        basket_of_goods: false,
        trans_type: 'SHELL_PURCHASE',
        trans_type_desc: 'Заправка Shell',
        reversal: false,
        processed_in_bo: true,
        is_shell: true
      }));
    }

    let combined = [...okkoTx, ...shellTx];

    // Filter by transaction type if specified
    if (transType && transType !== 'ALL') {
      combined = combined.filter(t => String(t.trans_type) === String(transType));
    }

    combined.sort((a, b) => 
      new Date(b.trans_date).getTime() - new Date(a.trans_date).getTime()
    );

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

  @Get('basket/:id')
  async getBasket(@Param('id') transId: string) {
    return this.okkoApiService.getBasketContent(transId);
  }

  @Get('metadata')
  async getMetadata() {
    return this.okkoApiService.getMetadata();
  }
}
