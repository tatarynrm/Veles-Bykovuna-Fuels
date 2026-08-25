import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Конвертація сум у гривню (базова валюта звітності ТОВ «Велес Буковина»).
 *
 * Навіщо: OKKO віддає суми в UAH, а Shell — у валюті інвойсу клієнта (для цього
 * платника це EUR). Дашборд підсумовує OKKO + Shell в одні KPI та підписує їх «грн»,
 * тож складати EUR із UAH без конвертації — некоректно. Нормалізуємо все до UAH за
 * ОФІЦІЙНИМ курсом НБУ (публічний, без ключа), кеш — одна доба.
 *
 * Джерело курсу: bank.gov.ua NBUStatService. `rate` — це кількість UAH за 1 одиницю
 * валюти, тобто саме множник UAH = amount * rate.
 */
@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly base = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';

  // Кеш курсів за добу: code -> { day: 'yyyy-mm-dd', rate }.
  private cache = new Map<string, { day: string; rate: number }>();
  // Дедуп паралельних запитів того самого курсу.
  private inflight = new Map<string, Promise<number>>();

  // Аварійний резерв, якщо НБУ недоступний і немає env-курсу та кешу. Свідомо грубі
  // значення (станом на 2026) — краще, ніж мовчазна «1:1», яка знищила б суми Shell.
  private static readonly FALLBACK: Record<string, number> = {
    EUR: 45,
    USD: 41,
    PLN: 11,
    GBP: 52,
  };

  constructor(private readonly configService: ConfigService) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Курс: скільки UAH коштує 1 одиниця валюти `code`. UAH → 1. */
  async getRateToUah(code?: string): Promise<number> {
    const cc = (code || '').trim().toUpperCase();
    if (!cc || cc === 'UAH' || cc === 'ГРН') return 1;

    const day = this.today();
    const cached = this.cache.get(cc);
    if (cached && cached.day === day) return cached.rate;

    const existing = this.inflight.get(cc);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const { data } = await axios.get(this.base, {
          params: { valcode: cc, json: true },
          timeout: 8000,
        });
        const rate = Array.isArray(data) && data[0] && Number(data[0].rate);
        if (rate && rate > 0) {
          this.cache.set(cc, { day, rate });
          return rate;
        }
        throw new Error('НБУ: порожній/некоректний курс');
      } catch (error) {
        // 1) env-перевизначення (FX_EUR_UAH тощо), 2) вчорашній кеш, 3) резерв.
        const envRate = Number(this.configService.get<string>(`FX_${cc}_UAH`));
        if (envRate && envRate > 0) {
          this.logger.warn(`Курс ${cc}→UAH з НБУ недоступний, беру FX_${cc}_UAH=${envRate}`);
          this.cache.set(cc, { day, rate: envRate });
          return envRate;
        }
        if (cached) {
          this.logger.warn(`Курс ${cc}→UAH з НБУ недоступний, беру вчорашній ${cached.rate}`);
          return cached.rate;
        }
        const fb = CurrencyService.FALLBACK[cc];
        if (fb) {
          this.logger.error(
            `Курс ${cc}→UAH недоступний (${error.message}) — використано АВАРІЙНИЙ резерв ${fb}. Задайте FX_${cc}_UAH у .env.`,
          );
          return fb;
        }
        this.logger.error(`Курс ${cc}→UAH невідомий (${error.message}) — конвертація 1:1`);
        return 1;
      } finally {
        this.inflight.delete(cc);
      }
    })();

    this.inflight.set(cc, promise);
    return promise;
  }

  /** Курси для набору валют одразу (кеш робить це дешевим). */
  async getRatesToUah(codes: string[]): Promise<Record<string, number>> {
    const distinct = Array.from(new Set(codes.map((c) => (c || '').trim().toUpperCase()).filter(Boolean)));
    const entries = await Promise.all(distinct.map(async (c) => [c, await this.getRateToUah(c)] as const));
    return Object.fromEntries(entries);
  }
}
