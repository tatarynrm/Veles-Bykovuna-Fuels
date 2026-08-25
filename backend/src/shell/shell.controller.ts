import { Controller, Get, Query } from '@nestjs/common';
import { ShellApiService } from './shell-api.service';

@Controller('api/shell')
export class ShellController {
  constructor(private readonly shellApiService: ShellApiService) {}

  @Get('user')
  async getUser() {
    return this.shellApiService.getLoggedInUser();
  }

  @Get('accounts')
  async getAccounts() {
    return this.shellApiService.getCustomerAccounts();
  }

  @Get('cards')
  async getCards() {
    return this.shellApiService.getCards();
  }

  @Get('merchants')
  async getMerchants() {
    return this.shellApiService.getShellMerchants();
  }

  @Get('transactions')
  async getTransactions(@Query('date_from') dateFrom?: string, @Query('date_to') dateTo?: string) {
    return this.shellApiService.getPricedTransactions(dateFrom, dateTo);
  }

  @Get('summary')
  async getSummary() {
    const accounts = await this.shellApiService.getCustomerAccounts();
    const cards = await this.shellApiService.getCards();
    const transactions = await this.shellApiService.getPricedTransactions();
    const merchants = await this.shellApiService.getShellMerchants();

    const totalSpendUah = transactions.reduce((sum, t) => sum + (t.GrossAmount || 0), 0);
    const totalVolumeLiters = transactions.reduce((sum, t) => sum + (t.FuelProduct ? t.Quantity || 0 : 0), 0);
    const activeCards = cards.filter(c => c.CardStatus === 'ACTIVE').length;

    return {
      brand: 'SHELL',
      totalAccounts: accounts.length,
      totalCards: cards.length,
      activeCards,
      totalMerchantsAZS: merchants.length,
      totalTransactions: transactions.length,
      totalSpendUah,
      totalVolumeLiters,
      accountsSummary: accounts
    };
  }
}
