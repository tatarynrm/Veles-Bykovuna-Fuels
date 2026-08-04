import { Injectable } from '@nestjs/common';
import { OkkoApiService } from '../okko/okko-api.service';
import { ShellApiService } from '../shell/shell-api.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly okkoApiService: OkkoApiService,
    private readonly shellApiService: ShellApiService,
  ) {}

  private filterByDateRange<T extends { trans_date?: string; date?: string; TransactionDate?: string }>(items: T[], dateFrom?: string, dateTo?: string): T[] {
    if (!dateFrom && !dateTo) return items;
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;

    return items.filter(item => {
      const itemDateStr = item.trans_date || item.date || item.TransactionDate;
      if (!itemDateStr) return true;
      const t = new Date(itemDateStr).getTime();
      return t >= from && t <= to;
    });
  }

  async getSummaryMetrics(dateFrom?: string, dateTo?: string, brand = 'ALL') {
    if (brand === 'SHELL') {
      const shellAccounts = await this.shellApiService.getCustomerAccounts();
      const shellCards = await this.shellApiService.getCards();
      const shellMerchants = await this.shellApiService.getShellMerchants();
      const rawShellTx = await this.shellApiService.getPricedTransactions(dateFrom, dateTo);
      const shellTx = this.filterByDateRange(rawShellTx, dateFrom, dateTo);

      const totalSpendUah = shellTx.reduce((sum, t) => sum + (t.GrossAmount || 0), 0);
      const totalVolumeLiters = shellTx.reduce((sum, t) => sum + (t.Quantity || 0), 0);
      const activeCards = shellCards.filter(c => c.CardStatus === 'ACTIVE').length;

      return {
        brand: 'SHELL',
        totalContracts: shellAccounts.length,
        totalBalanceUah: shellAccounts.reduce((s, a) => s + (a.GrossAmount || 0), 0),
        totalCards: shellCards.length,
        activeCards,
        totalMerchantsAZS: shellMerchants.length,
        totalTransactions: shellTx.length,
        totalSpendUah,
        totalVolumeLiters,
        totalDiscountsUah: 0,
        apiStatus: { mode: 'LIVE_SHELL_B2B_API', brand: 'Shell Mobility' }
      };
    }

    const contracts = await this.okkoApiService.getContracts();
    const cards = await this.okkoApiService.getCards();
    const merchants = await this.okkoApiService.getMerchants();
    const rawTransactions = await this.okkoApiService.getTransactions(dateFrom, dateTo);
    const transactions = this.filterByDateRange(rawTransactions, dateFrom, dateTo);

    const totalBalance = contracts.reduce((sum, c) => sum + (c.balance || 0), 0);
    const activeCards = cards.filter(c => c.is_active).length;
    const okkoSpend = transactions.reduce((sum, t) => sum + (t.amnt_trans || 0), 0);
    const okkoVolume = transactions.reduce((sum, t) => sum + (t.volume || 0), 0);
    const okkoDiscounts = transactions.reduce((sum, t) => sum + (t.amount_discount || 0), 0);

    if (brand === 'OKKO') {
      return {
        brand: 'OKKO',
        totalContracts: contracts.length,
        totalBalanceUah: totalBalance,
        totalCards: cards.length,
        activeCards,
        totalMerchantsAZS: merchants.length,
        totalTransactions: transactions.length,
        totalSpendUah: okkoSpend,
        totalVolumeLiters: okkoVolume,
        totalDiscountsUah: okkoDiscounts,
        apiStatus: this.okkoApiService.getApiStatus()
      };
    }

    // ALL (Combined Aggregated OKKO + Shell)
    const shellAccounts = await this.shellApiService.getCustomerAccounts();
    const shellCards = await this.shellApiService.getCards();
    const shellMerchants = await this.shellApiService.getShellMerchants();
    const rawShellTx = await this.shellApiService.getPricedTransactions(dateFrom, dateTo);
    const shellTx = this.filterByDateRange(rawShellTx, dateFrom, dateTo);

    const shellSpend = shellTx.reduce((sum, t) => sum + (t.GrossAmount || 0), 0);
    const shellVolume = shellTx.reduce((sum, t) => sum + (t.Quantity || 0), 0);

    return {
      brand: 'ALL',
      totalContracts: contracts.length + shellAccounts.length,
      totalBalanceUah: totalBalance + shellAccounts.reduce((s, a) => s + (a.GrossAmount || 0), 0),
      totalCards: cards.length + shellCards.length,
      activeCards: activeCards + shellCards.filter(c => c.CardStatus === 'ACTIVE').length,
      totalMerchantsAZS: merchants.length + shellMerchants.length,
      totalTransactions: transactions.length + shellTx.length,
      totalSpendUah: okkoSpend + shellSpend,
      totalVolumeLiters: okkoVolume + shellVolume,
      totalDiscountsUah: okkoDiscounts,
      apiStatus: { mode: 'MULTI_BRAND_HUB', brand: 'OKKO + Shell Combined' }
    };
  }

  async getFuelConsumptionBreakdown(dateFrom?: string, dateTo?: string, brand = 'ALL') {
    const rawOkkoTx = await this.okkoApiService.getTransactions(dateFrom, dateTo);
    const okkoTx = this.filterByDateRange(rawOkkoTx, dateFrom, dateTo);
    const breakdownMap = new Map<string, { product: string; volume: number; spend: number; count: number; brand: string }>();

    if (brand === 'ALL' || brand === 'OKKO') {
      for (const t of okkoTx) {
        const key = `OKKO: ${t.product_desc || 'Пальне ОККО'}`;
        const existing = breakdownMap.get(key) || { product: key, volume: 0, spend: 0, count: 0, brand: 'OKKO' };
        existing.volume += t.volume || 0;
        existing.spend += t.amnt_trans || 0;
        existing.count += 1;
        breakdownMap.set(key, existing);
      }
    }

    if (brand === 'ALL' || brand === 'SHELL') {
      const rawShellTx = await this.shellApiService.getPricedTransactions(dateFrom, dateTo);
      const shellTx = this.filterByDateRange(rawShellTx, dateFrom, dateTo);
      for (const t of shellTx) {
        const key = `Shell: ${t.ProductName || 'Пальне Shell'}`;
        const existing = breakdownMap.get(key) || { product: key, volume: 0, spend: 0, count: 0, brand: 'Shell' };
        existing.volume += t.Quantity || 0;
        existing.spend += t.GrossAmount || 0;
        existing.count += 1;
        breakdownMap.set(key, existing);
      }
    }

    return Array.from(breakdownMap.values());
  }

  async getSpendingTrends(dateFrom?: string, dateTo?: string, brand = 'ALL') {
    const trendsMap = new Map<string, { date: string; spend: number; volume: number; okkoSpend: number; shellSpend: number }>();

    if (brand === 'ALL' || brand === 'OKKO') {
      const rawOkkoTx = await this.okkoApiService.getTransactions(dateFrom, dateTo);
      const okkoTx = this.filterByDateRange(rawOkkoTx, dateFrom, dateTo);
      for (const t of okkoTx) {
        const dateKey = (t.trans_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        const existing = trendsMap.get(dateKey) || { date: dateKey, spend: 0, volume: 0, okkoSpend: 0, shellSpend: 0 };
        existing.okkoSpend += t.amnt_trans || 0;
        existing.spend += t.amnt_trans || 0;
        existing.volume += t.volume || 0;
        trendsMap.set(dateKey, existing);
      }
    }

    if (brand === 'ALL' || brand === 'SHELL') {
      const rawShellTx = await this.shellApiService.getPricedTransactions(dateFrom, dateTo);
      const shellTx = this.filterByDateRange(rawShellTx, dateFrom, dateTo);
      for (const t of shellTx) {
        const dateKey = (t.TransactionDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        const existing = trendsMap.get(dateKey) || { date: dateKey, spend: 0, volume: 0, okkoSpend: 0, shellSpend: 0 };
        existing.shellSpend += t.GrossAmount || 0;
        existing.spend += t.GrossAmount || 0;
        existing.volume += t.Quantity || 0;
        trendsMap.set(dateKey, existing);
      }
    }

    const sortedTrends = Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sortedTrends;
  }
}
