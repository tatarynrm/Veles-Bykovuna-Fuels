import { Controller, Get, Query } from '@nestjs/common';
import { OkkoApiService } from '../okko/okko-api.service';
import { ShellApiService } from '../shell/shell-api.service';

@Controller('api/cards')
export class CardsController {
  constructor(
    private readonly okkoApiService: OkkoApiService,
    private readonly shellApiService: ShellApiService,
  ) {}

  @Get()
  async getAllCards(
    @Query('contract_id') contractId?: string,
    @Query('brand') brand?: string,
    @Query('page') pageStr?: string,
    @Query('size') sizeStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const size = Math.max(1, parseInt(sizeStr || '10', 10));

    let okkoCards: any[] = [];
    let shellCards: any[] = [];

    if (brand !== 'SHELL') {
      okkoCards = await this.okkoApiService.getCards(contractId);
    }
    if (brand !== 'OKKO') {
      const rawShell = await this.shellApiService.getCards();
      shellCards = rawShell.map(c => ({
        card_num: c.CardPAN,
        contract_id: c.PayerNumber,
        status: c.CardStatus === 'ACTIVE' ? 'ACTV' : 'BLCK',
        status_desc: c.CardStatus === 'ACTIVE' ? 'Активна Shell Card' : 'Заблокована',
        is_active: c.CardStatus === 'ACTIVE',
        card_owner_f_name: c.DriverName,
        card_owner_l_name: `(${c.VehicleRegistration})`,
        exp_date: c.ExpiryDate,
        product_name: c.ProductRestriction,
        limits: [
          {
            limit_id: '1',
            limit_type: '0',
            limit_desc: 'Добовий ліміт Shell Mobility',
            limit_value: 50000,
            limit_remains: 42000,
            limit_used: 8000,
            cycle_type_desc: 'доба'
          }
        ],
        is_shell: true
      }));
    }

    const combined = [...okkoCards, ...shellCards];
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

  @Get('stats')
  async getCardStats() {
    const cards = await this.okkoApiService.getCards();
    const activeCards = cards.filter(c => c.is_active).length;
    const blockedCards = cards.length - activeCards;

    return {
      totalCards: cards.length,
      activeCards,
      blockedCards,
      activeRatio: cards.length > 0 ? Math.round((activeCards / cards.length) * 100) : 100,
    };
  }
}
