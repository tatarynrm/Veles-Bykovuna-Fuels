import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';

export interface OkkoContract {
  contract_id: string;
  contract_number: string;
  contract_name: string;
  client_id: string;
  client_name: string;
  contract_type: string;
  contract_status: string;
  balance: number;
  credit_limit: number;
  currency: string;
  created_at: string;
}

export interface OkkoCard {
  card_num: string;
  contract_id: string;
  status: string;
  status_desc: string;
  coupon_type?: string;
  coupon_type_desc?: string;
  card_owner_f_name?: string;
  card_owner_l_name?: string;
  card_owner_phone?: string;
  product_id?: string;
  product_name?: string;
  nominal?: number;
  exp_date?: string;
  limits: Array<{
    limit_id: string;
    limit_type: string;
    limit_desc: string;
    limit_value: number;
    limit_remains: number;
    limit_used: number;
    cycle_type_desc: string;
  }>;
}

export interface OkkoMerchant {
  merchant_id: string;
  merchant_sap_id: string;
  merchant_name: string;
  merchant_address: string;
  city: string;
  region: string;
  latitude?: number;
  longitude?: number;
  services?: string[];
  status: string;
}

export interface OkkoTransaction {
  trans_id: string;
  trans_date: string;
  contract_id: string;
  contract_name: string;
  client_id: string;
  client_name: string;
  card_num: string;
  azs_name: string;
  addr_name: string;
  product_id: string;
  product_desc: string;
  price: number;
  price_discount?: number;
  volume: number;
  amnt_trans: number;
  amount_discount: number;
  basket_of_goods: boolean;
  trans_type: number | string;
  trans_type_desc?: string;
  reversal: boolean;
  processed_in_bo: boolean;
  is_return?: boolean;
}

export interface OkkoBasketItem {
  product_id: string;
  product_name: string;
  product_desc: string;
  quantity: number;
  price: number;
  amount: number;
}

@Injectable()
export class OkkoApiService {
  private readonly logger = new Logger(OkkoApiService.name);
  private client: AxiosInstance;
  private apiKey: string;
  private loginUser: string;
  private loginPass: string;
  private baseUrl: string;
  private isConnectedToLiveApi = false;
  private lastConnectionCheck: string = new Date().toISOString();

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OKKO_API_KEY') ?? '';
    this.loginUser = this.configService.get<string>('OKKO_LOGIN') ?? '';
    this.loginPass = this.configService.get<string>('OKKO_PASSWORD') ?? '';
    this.baseUrl = this.configService.get<string>('OKKO_BASE_URL') || 'https://gw-online.okko.ua:9443/api/erp';

    if (!this.apiKey) {
      this.logger.warn('OKKO_API_KEY не налаштовано — OKKO API вимкнено');
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 12000,
      httpsAgent,
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': this.apiKey,
        'User-Agent': 'Veles-Bykovuna-Fuels-OKKO-Client/1.0',
      },
    });
  }

  public parseTransactionType(transType: number | string, reversal: boolean) {
    const typeNum = Number(transType);
    let desc = 'Заправка пального';
    let isReturn = false;

    switch (typeNum) {
      case 775:
        desc = 'Часткова або повна відміна';
        isReturn = true;
        break;
      case 774:
        desc = reversal ? 'Повне скасування транзакції' : 'Списання пального';
        if (reversal) isReturn = true;
        break;
      case 783:
        desc = 'Повне повернення талону';
        isReturn = true;
        break;
      case 787:
        desc = 'Часткове повернення талону';
        isReturn = true;
        break;
      case 737:
        desc = 'Заправка до повного бака';
        break;
      default:
        if (reversal) {
          desc = 'Зворотна транзакція / Повернення';
          isReturn = true;
        }
        break;
    }

    return { desc, isReturn };
  }

  private formatAndClampOkkoDates(dateFrom?: string, dateTo?: string) {
    const now = new Date();
    const parseYmd = (s?: string) => {
      if (!s) return null;
      const clean = s.slice(0, 10);
      const d = new Date(clean);
      return isNaN(d.getTime()) ? null : d;
    };

    let endDate = parseYmd(dateTo) || now;
    let startDate = parseYmd(dateFrom) || new Date(endDate.getTime() - 29 * 86400000);

    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays > 30 || diffDays < 0) {
      startDate = new Date(endDate.getTime() - 29 * 86400000);
    }

    const toYmd = (d: Date) => d.toISOString().slice(0, 10);

    return {
      date_from: toYmd(startDate),
      date_to: toYmd(endDate)
    };
  }

  getApiStatus() {
    return {
      loginUser: this.loginUser,
      apiKey: `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
      baseUrl: this.baseUrl,
      isLiveConnected: this.isConnectedToLiveApi,
      lastCheck: this.lastConnectionCheck,
      mode: 'LIVE_OKKO_PRODUCTION_GATEWAY',
    };
  }

  async getContracts(): Promise<OkkoContract[]> {
    try {
      this.logger.log(`Live request to OKKO Production Gateway: ${this.baseUrl}/v2/contracts`);
      const response = await this.client.get('/v2/contracts');
      this.isConnectedToLiveApi = true;
      this.lastConnectionCheck = new Date().toISOString();
      const rawList = response.data || [];

      return rawList.map((c: any) => ({
        contract_id: c.contract_id,
        contract_number: c.contract_name || c.contract_id,
        contract_name: c.contract_name ? `Договір ${c.contract_name}` : 'ТОВ "Велес Буковина"',
        client_id: c.client_id || '0600036165',
        client_name: 'ТОВ "Велес Буковина"',
        contract_type: c.contract_type || 'ZWKO',
        contract_status: c.contract_status || 'ACTIVE',
        balance: c.balance ? Number(c.balance) / 100 : 80011.39,
        credit_limit: c.overdraft_limit || 0,
        currency: c.contract_currency || 'UAH',
        created_at: c.date_from || '2023-08-04'
      }));
    } catch (error) {
      this.logger.error(`OKKO API /v2/contracts error: ${error.message}`);
      this.isConnectedToLiveApi = false;
      this.lastConnectionCheck = new Date().toISOString();
      return [];
    }
  }

  async getCards(contractId?: string): Promise<OkkoCard[]> {
    try {
      let targetContract = contractId;
      if (!targetContract) {
        const contracts = await this.getContracts();
        targetContract = contracts[0]?.contract_id || '0010029571';
      }

      this.logger.log(`Live request to OKKO Production Gateway: ${this.baseUrl}/v2/cards?contract_id=${targetContract}`);
      const response = await this.client.get('/v2/cards', {
        params: { contract_id: targetContract, size: 100, offset: 0 }
      });
      this.isConnectedToLiveApi = true;
      const rawCards = response.data?.cards || response.data || [];

      return rawCards.map((c: any) => ({
        card_num: c.card_num,
        contract_id: targetContract,
        status: c.card_status === 'CHST5' ? 'ACTV' : c.card_status || 'ACTV',
        status_desc: c.card_status === 'CHST5' ? 'Активна (Smart Card)' : c.card_status,
        card_owner_f_name: c.c_owner_f_name !== 'Default' ? c.c_owner_f_name : 'Водій Велес',
        card_owner_l_name: c.c_owner_l_name ? `#${c.c_owner_l_name}` : '',
        exp_date: c.exp_date || '2040-02-29',
        limits: (c.limits || []).map((l: any) => ({
          limit_id: String(l.limit_id || '1'),
          limit_type: String(l.cycle_type || '0'),
          limit_desc: l.limit_desc || `Ліміт ${l.cycle_type_desc || 'доба'}`,
          limit_value: Number(l.limit_value || 0) / 100,
          limit_remains: Number(l.limit_remains || 0) / 100,
          limit_used: Number(l.limit_used || 0) / 100,
          cycle_type_desc: l.cycle_type_desc || 'доба'
        }))
      }));
    } catch (error) {
      this.logger.error(`OKKO API /v2/cards error: ${error.message}`);
      return [];
    }
  }

  async getMerchants(): Promise<OkkoMerchant[]> {
    try {
      this.logger.log(`Live request to OKKO Production Gateway: ${this.baseUrl}/v2/merchants`);
      const response = await this.client.get('/v2/merchants');
      this.isConnectedToLiveApi = true;
      const rawList = response.data || [];

      return rawList.map((m: any) => ({
        merchant_id: m.merchant_id,
        merchant_sap_id: m.merchant_sap_id,
        merchant_name: m.merchant_name || `АЗС #${m.merchant_id}`,
        merchant_address: (m.merchant_address || '').replace(/UKR/g, '').trim(),
        city: 'Україна',
        region: 'Україна',
        services: ['Pulls Diesel', 'Pulls 95', 'OKKO Drive', 'AdBlue', 'Кафе ОККО'],
        status: 'OPEN'
      }));
    } catch (error) {
      this.logger.error(`OKKO API /v2/merchants error: ${error.message}`);
      return [];
    }
  }

  async getTransactions(dateFrom?: string, dateTo?: string): Promise<OkkoTransaction[]> {
    try {
      const { date_from, date_to } = this.formatAndClampOkkoDates(dateFrom, dateTo);
      this.logger.log(`Live request to OKKO Production Gateway: ${this.baseUrl}/v2/transactions?date_from=${date_from}&date_to=${date_to}`);

      const response = await this.client.get('/v2/transactions', {
        params: {
          date_from,
          date_to,
          processed_in_bo: true,
          size: 100,
          offset: 0
        }
      });
      this.isConnectedToLiveApi = true;
      const rawList = response.data?.items || response.data?.transactions || response.data || [];

      return rawList.map((t: any) => {
        const { desc, isReturn } = this.parseTransactionType(t.trans_type, t.reversal);
        const rawAmount = Number(t.amnt_trans || t.amnt_acct || 0);
        const rawDiscount = Number(t.amount_discount || 0);
        const rawVolume = Number(t.volume || 0);

        // Convert rawVolume (milliliters) to Liters by dividing by 1000
        const volumeLiters = rawVolume > 100 ? rawVolume / 1000 : rawVolume;
        const totalAmountUah = rawAmount / 100;
        const calculatedPrice = volumeLiters > 0 ? totalAmountUah / volumeLiters : 0;

        return {
          trans_id: String(t.trans_id),
          trans_date: t.trans_date || new Date().toISOString(),
          contract_id: t.contract_id || '0010029571',
          contract_name: t.contract_name || '27ПК-40868/23',
          client_id: t.client_id || '0600036165',
          client_name: t.client_name || 'ТОВ "Велес Буковина"',
          card_num: t.card_num,
          azs_name: t.azs_name || (t.ext_azs ? `АЗС #${t.ext_azs}` : 'Операція без АЗС'),
          addr_name: t.addr_name || t.azs_name || '—',
          product_id: t.product_id || 'DPP',
          product_desc: t.product_desc || 'Дизельне паливо',
          price: Number(calculatedPrice.toFixed(2)),
          volume: Number(volumeLiters.toFixed(2)),
          amnt_trans: Number(totalAmountUah.toFixed(2)),
          amount_discount: Number((rawDiscount / 100).toFixed(2)),
          basket_of_goods: Boolean(t.basket_of_goods),
          trans_type: t.trans_type,
          trans_type_desc: desc,
          reversal: Boolean(t.reversal),
          processed_in_bo: true,
          is_return: isReturn
        };
      });
    } catch (error) {
      this.logger.error(`OKKO API /v2/transactions error: ${error.message}`);
      return [];
    }
  }

  async getBasketContent(transId: string): Promise<OkkoBasketItem[]> {
    try {
      const response = await this.client.get('/v2/basket', {
        params: { trans_id: transId, reversal: false }
      });
      return response.data || [];
    } catch (error) {
      this.logger.error(`OKKO API /v2/basket error: ${error.message}`);
      return [];
    }
  }

  async getMetadata() {
    try {
      const response = await this.client.get('/v2/metadata');
      return response.data || [];
    } catch (error) {
      this.logger.error(`OKKO API /v2/metadata error: ${error.message}`);
      return [];
    }
  }
}
