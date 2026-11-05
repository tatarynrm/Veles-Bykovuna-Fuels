import { Controller, ForbiddenException, Get, Headers, Query } from '@nestjs/common';
import { isGuestRole, roleFromToken } from '../auth/session';
import { PrivatApiService, PrivatScope } from './privat-api.service';

const SCOPES: PrivatScope[] = ['period', 'interim', 'final'];

/**
 * PrivatBank statements for the «Банк → Приват24» section. Read-only by construction
 * (the adapter has no write calls).
 *
 * Unlike the fuel feeds, a company's bank statement is not something a public guest
 * login (`guest`/`guest`, printed on the sign-in screen) should see — `ReadOnlyGuard`
 * only blocks writes, so the guest is refused here explicitly.
 */
@Controller('api/privat')
export class PrivatController {
  constructor(private readonly privat: PrivatApiService) {}

  private deny(authorization?: string): void {
    if (isGuestRole(roleFromToken(authorization))) {
      throw new ForbiddenException('Банківські виписки недоступні для гостьового входу.');
    }
  }

  private scope(raw?: string): PrivatScope {
    return SCOPES.includes(raw as PrivatScope) ? (raw as PrivatScope) : 'period';
  }

  @Get('status')
  getStatus(@Headers('authorization') auth?: string) {
    this.deny(auth);
    return this.privat.getStatus();
  }

  /** Bank server clock + work phase (`statements/settings`). */
  @Get('settings')
  getSettings(@Headers('authorization') auth?: string) {
    this.deny(auth);
    return this.privat.getSettings();
  }

  /** Corporate cards (separate card API): corporations and every card with balance/holder/state. */
  @Get('cards')
  getCards(
    @Headers('authorization') auth?: string,
    @Query('state') state?: string,
    @Query('force') force?: string,
  ) {
    this.deny(auth);
    return this.privat.getCards({
      state: state === 'c' || state === 'all' ? state : 'o',
      force: force === '1' || force === 'true',
    });
  }

  /**
   * Card operations for a period (card API, not the account statement). `corp` narrows to one
   * corporation (`CorpCode`), `card` to one card (its `pan_key`).
   */
  @Get('card-transactions')
  getCardTransactions(
    @Headers('authorization') auth?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('corp') corp?: string,
    @Query('card') card?: string,
    @Query('force') force?: string,
  ) {
    this.deny(auth);
    return this.privat.getCardTransactions({
      startDate: startDate ?? '',
      endDate,
      corp,
      card,
      force: force === '1' || force === 'true',
    });
  }

  /** Account balances and turnovers. `scope`: period (default) | interim | final. */
  @Get('balances')
  getBalances(
    @Headers('authorization') auth?: string,
    @Query('scope') scope?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('acc') acc?: string,
    @Query('force') force?: string,
  ) {
    this.deny(auth);
    return this.privat.getBalances({
      scope: this.scope(scope),
      startDate,
      endDate,
      acc,
      force: force === '1' || force === 'true',
    });
  }

  /** Every transaction of the period, all pages, newest first, with per-currency totals. */
  @Get('transactions')
  getTransactions(
    @Headers('authorization') auth?: string,
    @Query('scope') scope?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('acc') acc?: string,
    @Query('force') force?: string,
  ) {
    this.deny(auth);
    return this.privat.getTransactions({
      scope: this.scope(scope),
      startDate,
      endDate,
      acc,
      force: force === '1' || force === 'true',
    });
  }
}
