import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import {
  OkkoContract,
  OkkoCard,
  OkkoMerchant,
  OkkoTransaction,
  OkkoBasketItem,
  formatAndClampOkkoDates,
  mapContract,
  mapCard,
  mapMerchant,
  mapTransaction,
} from './okko.mapper';

// Normalized shapes, dictionaries and pure conversions live in ./okko.mapper
// (unit-tested there). Re-exported so existing `OkkoApiService` consumers that
// reference these types keep resolving them from this module.
export type {
  OkkoContract,
  OkkoCard,
  OkkoMerchant,
  OkkoTransaction,
  OkkoBasketItem,
} from './okko.mapper';
export { OKKO_CARD_STATUS, parseTransactionType } from './okko.mapper';

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

      return rawList.map(mapContract);
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

      return rawCards.map((c: any) => mapCard(c, targetContract));
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

      return rawList.map(mapMerchant);
    } catch (error) {
      this.logger.error(`OKKO API /v2/merchants error: ${error.message}`);
      return [];
    }
  }

  async getTransactions(dateFrom?: string, dateTo?: string): Promise<OkkoTransaction[]> {
    try {
      const { date_from, date_to } = formatAndClampOkkoDates(dateFrom, dateTo);
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

      return rawList.map(mapTransaction);
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
