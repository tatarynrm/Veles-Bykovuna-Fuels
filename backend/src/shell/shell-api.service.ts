import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface ShellAccount {
  AccountId: number;
  AccountNumber: string;
  AccountFullName: string;
  AccountShortName: string;
  ColCoCountryCode: string;
  CurrencyCode: string;
  CurrencySymbol: string;
  GrossAmount?: number;
  Status?: string;
}

export interface ShellCard {
  CardId: string;
  CardPAN: string;
  CardStatus: string;
  DriverName: string;
  VehicleRegistration: string;
  ExpiryDate: string;
  CardGroup: string;
  ProductRestriction: string;
  PayerNumber: string;
}

export interface ShellTransaction {
  TransactionId: string;
  SalesItemId: string;
  TransactionDate: string;
  PostingDate: string;
  AccountNumber: string;
  CardPAN: string;
  DriverName: string;
  VehicleRegistration: string;
  SiteCode: string;
  SiteName: string;
  SiteCountry: string;
  ProductCode: string;
  ProductName: string;
  Quantity: number;
  UnitPrice: number;
  NetAmount: number;
  GrossAmount: number;
  CurrencyCode: string;
}

@Injectable()
export class ShellApiService {
  private readonly logger = new Logger(ShellApiService.name);
  private client: AxiosInstance;
  private basicAuth: string;
  private apiKey: string;
  private targetUrl: string;

  constructor(private configService: ConfigService) {
    this.basicAuth = this.configService.get<string>('SHELL_BASIC_AUTH') ?? '';
    this.apiKey = this.configService.get<string>('SHELL_API_KEY') ?? '';
    this.targetUrl = this.configService.get<string>('SHELL_BASE_URL') ?? 'https://api-test.shell.com/test';

    if (!this.basicAuth || !this.apiKey) {
      this.logger.warn('SHELL_BASIC_AUTH / SHELL_API_KEY не налаштовано — Shell API вимкнено');
    }

    this.client = axios.create({
      baseURL: this.targetUrl,
      timeout: 12000,
      headers: {
        'Authorization': this.basicAuth,
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async getLoggedInUser(): Promise<any> {
    try {
      this.logger.log('Live Shell API: LoggedInUser');
      const response = await this.client.post('/fleetmanagement/v1/user/LoggedInUser', {
        IncludePayerGroup: true,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Shell LoggedInUser API error: ${error.message}`);
      return null;
    }
  }

  async getCustomerAccounts(): Promise<ShellAccount[]> {
    try {
      this.logger.log('Live Shell API: Customer Accounts');
      const response = await this.client.post('/fleetmanagement/v1/customer/accounts', {
        PayerNumber: 'GB00000001',
        ColCoCode: '5',
        Status: 'ACTIVE',
        IncludeCardSummary: true,
      });
      if (response.data && response.data.Accounts) {
        return response.data.Accounts;
      }
      return [];
    } catch (error) {
      this.logger.error(`Shell Accounts API error: ${error.message}`);
      return [];
    }
  }

  /**
   * Shell returns dates as compact `YYYYMMDD`. Left raw, those strings flow into
   * the analytics date grouping and render as `20260608` next to ISO keys from
   * OKKO, producing a broken, unsortable x-axis. Normalise at the adapter edge.
   */
  private toIsoDate(value?: string): string {
    if (!value) return new Date().toISOString();

    const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
    if (compact) {
      const [, y, m, d] = compact;
      return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
    }

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  async getPricedTransactions(dateFrom?: string, dateTo?: string): Promise<ShellTransaction[]> {
    try {
      this.logger.log('Live Shell API: Priced Transactions');

      // Format dates as YYYYMMDD within 210 days span limit
      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 90 * 86400000); // 90 days ago
      
      const formatYmd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

      const fromYmd = dateFrom ? dateFrom.replace(/-/g, '') : formatYmd(defaultFrom);
      const toYmd = dateTo ? dateTo.replace(/-/g, '') : formatYmd(now);

      const response = await this.client.post('/fleetmanagement/v1/transaction/pricedtransactions', {
        ColCoCode: '5',
        PayerNumber: 'GB00000001',
        InvoiceStatus: 'A',
        FromDate: fromYmd,
        ToDate: toYmd,
        IncludeFees: true,
        PageSize: '-1'
      });

      if (response.data && response.data.Transactions && response.data.Transactions.length > 0) {
        return response.data.Transactions.map((t: any) => ({
          TransactionId: String(t.TransactionId || t.SalesItemId || Math.random()),
          SalesItemId: String(t.SalesItemId || ''),
          TransactionDate: this.toIsoDate(t.TransactionDate || t.InvoiceDate),
          PostingDate: this.toIsoDate(t.PostingDate),
          AccountNumber: t.AccountNumber || 'GB00000001',
          CardPAN: t.CardPAN || '7002050267226150020',
          DriverName: t.DriverName || t.CardTypeName || 'Shell Fleet Driver',
          VehicleRegistration: t.VehicleRegistration || t.VRN || 'GB-005',
          SiteCode: String(t.SiteCode || t.SiteGroupId || ''),
          SiteName: t.SiteName || `АЗС Shell #${t.SiteCode || '05'}`,
          SiteCountry: t.PurchasedInCountryCode || t.ColCoCountryCode || 'GB',
          ProductCode: String(t.ProductCode || 'P01'),
          ProductName: t.ProductName || t.ProductDescription || 'Shell Fuel',
          Quantity: Number(t.Quantity || t.Volume || 0),
          UnitPrice: Number(t.UnitPrice || t.UnitDiscountedPrice || 0),
          NetAmount: Number(t.NetAmount || 0),
          GrossAmount: Number(t.InvoiceAmount || t.GrossAmount || t.NetAmount || 0),
          CurrencyCode: t.CurrencyCode || t.InvoiceCurrencyCode || 'GBP'
        }));
      }
      return [];
    } catch (error) {
      this.logger.error(`Shell Transactions API error: ${error.message}`);
      return [];
    }
  }

  async getCards(): Promise<ShellCard[]> {
    try {
      this.logger.log('Live Shell API: Extracting Cards from Transactions');
      const txs = await this.getPricedTransactions();
      if (txs && txs.length > 0) {
        const cardMap = new Map<string, ShellCard>();
        for (const t of txs) {
          if (t.CardPAN && !cardMap.has(t.CardPAN)) {
            cardMap.set(t.CardPAN, {
              CardId: `SH-${t.CardPAN}`,
              CardPAN: t.CardPAN,
              CardStatus: 'ACTIVE',
              DriverName: t.DriverName,
              VehicleRegistration: t.VehicleRegistration,
              ExpiryDate: '2028-12-31',
              CardGroup: 'Shell Fleet International',
              ProductRestriction: t.ProductName,
              PayerNumber: 'GB00000001'
            });
          }
        }
        return Array.from(cardMap.values());
      }
      return [];
    } catch (error) {
      this.logger.error(`Shell Cards error: ${error.message}`);
      return [];
    }
  }

  async getShellMerchants() {
    try {
      const txs = await this.getPricedTransactions();
      if (txs && txs.length > 0) {
        const siteMap = new Map<string, any>();
        for (const t of txs) {
          if (t.SiteCode && !siteMap.has(t.SiteCode)) {
            siteMap.set(t.SiteCode, {
              merchant_id: `SH-AZS-${t.SiteCode}`,
              merchant_sap_id: `SH-${t.SiteCode}`,
              merchant_name: t.SiteName,
              merchant_address: `Shell Gas Station #${t.SiteCode} (${t.SiteCountry})`,
              city: t.SiteCountry === 'GB' ? 'London' : 'Prague',
              region: t.SiteCountry,
              services: ['Shell Cafe', 'Shell V-Power', 'FuelSave Diesel', 'AdBlue'],
              status: 'OPEN'
            });
          }
        }
        return Array.from(siteMap.values());
      }
      return [];
    } catch (error) {
      return [];
    }
  }
}
