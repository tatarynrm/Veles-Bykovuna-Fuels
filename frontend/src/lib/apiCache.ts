/**
 * Кеш відповідей API зі стратегією stale-while-revalidate.
 *
 * Навіщо: вендорські шлюзи (OKKO, Shell) відповідають довго — десятки секунд на
 * широкий діапазон дат. Через це кожен перехід на сторінку показував скелетон,
 * навіть якщо ті самі дані щойно бачили. Тепер:
 *
 *   1) є свіжий запис (молодший за ttl) — мережу не чіпаємо взагалі;
 *   2) є застарілий — МАЛЮЄМО його негайно й тихо перепитуємо у фоні,
 *      а коли відповідь прийде, віддаємо її через `onFresh`;
 *   3) немає нічого — звичайне очікування зі скелетоном.
 *
 * Кеш переживає перезавантаження сторінки (localStorage), бо саме там чекання
 * найпомітніше: холодний старт вкладки — це знову довгі запити.
 *
 * Що НЕ кешується: усе, що не проходить через ці функції, — зокрема
 * телеметрія реального часу (`/api/ruptela/vehicles/:id/coordinates`). Показати
 * позицію вантажівки «з кешу» гірше, ніж показати спінер.
 */

import { useEffect, useState } from 'react';
import { apiGet, unwrapList } from './api';

const STORE_PREFIX = 'veles_cache_v1:';

/** Свіже — мережу не турбуємо. */
const DEFAULT_TTL_MS = 30_000;
/** Старіше за це не показуємо навіть тимчасово: краще скелетон, ніж вчорашні цифри. */
const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** Одна відповідь понад ~700 КБ у сховище не йде — місця там ~5 МБ на все. */
const MAX_ENTRY_CHARS = 700_000;

export interface CacheOptions {
  ttlMs?: number;
  maxAgeMs?: number;
  /** Ручне «Оновити» — читання кешу пропускаємо, запис лишається. */
  force?: boolean;
}

interface Entry<T> {
  at: number;
  data: T;
}

type QueryValue = string | number | boolean | undefined | null;

/** Ключ не залежить від порядку полів у params — інакше той самий запит мав би два записи. */
export function cacheKey(path: string, params?: Record<string, QueryValue>): string {
  if (!params) return path;
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return pairs.length ? `${path}?${pairs.map(([k, v]) => `${k}=${v}`).join('&')}` : path;
}

/* ── сховище ────────────────────────────────────────────────────────────── */

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function readStored<T>(key: string): Entry<T> | null {
  const hit = memory.get(key);
  if (hit) return hit as Entry<T>;
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (!parsed || typeof parsed.at !== 'number') return null;
    memory.set(key, parsed as Entry<unknown>);
    return parsed;
  } catch {
    /* зіпсований запис — так, ніби його й не було */
    return null;
  }
}

/**
 * Викидає найстаріші записи, поки запис не влізе. Квота ділиться з рештою
 * застосунку (сесія, налаштування карти), тож при переповненні жертвуємо
 * саме кешем, а не чиїмись налаштуваннями.
 */
function evictOldest(): boolean {
  if (typeof window === 'undefined') return false;
  let oldestKey: string | null = null;
  let oldestAt = Infinity;

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const storageKey = window.localStorage.key(i);
    if (!storageKey?.startsWith(STORE_PREFIX)) continue;
    try {
      const at = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}')?.at ?? 0;
      if (at < oldestAt) {
        oldestAt = at;
        oldestKey = storageKey;
      }
    } catch {
      oldestKey = storageKey; // нечитабельний запис — перший кандидат на виліт
      break;
    }
  }

  if (!oldestKey) return false;
  window.localStorage.removeItem(oldestKey);
  memory.delete(oldestKey.slice(STORE_PREFIX.length));
  return true;
}

function writeStored<T>(key: string, data: T): void {
  const entry: Entry<T> = { at: Date.now(), data };
  memory.set(key, entry as Entry<unknown>);
  if (typeof window === 'undefined') return;

  let payload: string;
  try {
    payload = JSON.stringify(entry);
  } catch {
    return; // дані з циклами до сховища не потраплять — лишаємо тільки в пам'яті
  }
  if (payload.length > MAX_ENTRY_CHARS) return;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      window.localStorage.setItem(STORE_PREFIX + key, payload);
      return;
    } catch {
      if (!evictOldest()) return;
    }
  }
}

/** Час останнього оновлення запису — для підпису «дані станом на …». */
export function cachedAt(path: string, params?: Record<string, QueryValue>): number | null {
  return readStored(cacheKey(path, params))?.at ?? null;
}

/** Прибирає весь кеш. Викликається при виході з сесії. */
export function clearApiCache(): void {
  memory.clear();
  inflight.clear();
  if (typeof window === 'undefined') return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORE_PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* нічого страшного: кеш і так лише пришвидшує */
  }
}

/* ── читання ────────────────────────────────────────────────────────────── */

/* ── індикатор фонового оновлення ───────────────────────────────────────── */

const activityListeners = new Set<(count: number) => void>();

function notifyActivity(): void {
  activityListeners.forEach((fn) => fn(inflight.size));
}

/**
 * Показує, що на екрані може бути кеш, а свіже ще їде. Без цього фонове
 * оновлення виглядало б як «нічого не відбувається», а потім цифри раптом
 * стрибали б.
 */
export function useApiRefreshing(): boolean {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(inflight.size > 0);
    const fn = (count: number) => setBusy(count > 0);
    activityListeners.add(fn);
    return () => {
      activityListeners.delete(fn);
    };
  }, []);

  return busy;
}

/** Один мережевий запит на ключ, скільки б місць його одночасно не просило. */
function fetchOnce<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = run()
    .then((data) => {
      writeStored(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
      notifyActivity();
    });

  inflight.set(key, promise);
  notifyActivity();
  return promise;
}

async function swr<T>(
  key: string,
  run: () => Promise<T>,
  fallback: T,
  onFresh: ((data: T) => void) | undefined,
  options: CacheOptions,
): Promise<T> {
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxAge = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cached = options.force ? null : readStored<T>(key);
  const age = cached ? Date.now() - cached.at : Infinity;

  if (cached && age <= ttl) return cached.data;

  if (cached && age <= maxAge) {
    // Малюємо застаріле негайно, а свіже віддамо через onFresh.
    void fetchOnce(key, run)
      .then((data) => onFresh?.(data))
      .catch(() => {
        /* мережа впала — на екрані лишається кеш, це краще за порожній стан */
      });
    return cached.data;
  }

  try {
    return await fetchOnce(key, run);
  } catch {
    return fallback;
  }
}

/**
 * Колекція з кешем. Сигнатура повторює `apiList`, плюс `onFresh` — колбек,
 * який спрацює, коли фонове оновлення принесе новіші дані (зазвичай це
 * setState сторінки).
 */
export function cachedList<T>(
  path: string,
  params?: Record<string, QueryValue>,
  onFresh?: (items: T[]) => void,
  options: CacheOptions = {},
): Promise<T[]> {
  const key = cacheKey(path, params);
  return swr<T[]>(
    key,
    async () => unwrapList<T>(await apiGet<unknown>(path, params)),
    [],
    onFresh,
    options,
  );
}

/** Один об'єкт із кешем. Аналог `apiObject`. */
export function cachedObject<T>(
  path: string,
  params?: Record<string, QueryValue>,
  onFresh?: (data: T | null) => void,
  options: CacheOptions = {},
): Promise<T | null> {
  const key = cacheKey(path, params);
  return swr<T | null>(key, () => apiGet<T>(path, params), null, onFresh, options);
}

/** Чи є що показати миттєво — сторінка вирішує, малювати скелетон чи ні. */
export function hasFreshEnough(
  path: string,
  params?: Record<string, QueryValue>,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): boolean {
  const at = cachedAt(path, params);
  return at !== null && Date.now() - at <= maxAgeMs;
}
