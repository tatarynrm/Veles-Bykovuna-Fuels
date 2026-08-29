/**
 * Shared caching primitives for the vendor adapters.
 *
 * Before this module, the stale-while-revalidate + in-flight-dedup + TTL-memoize
 * patterns were hand-rolled in three places (Ruptela routing trips, the fleet
 * snapshot, and the insights registry). They are consolidated here so the subtle
 * parts — "serve stale, refresh behind it", "a throttled request is not no-data",
 * "never advance the timestamp on a cold failure so it keeps retrying" — live in
 * one tested place instead of drifting between copies.
 *
 * Pure TypeScript, no Nest/axios dependency, so it is straightforward to unit-test.
 */

export interface SwrEntry<T> {
  data: T;
  /** ms epoch of the last successful load; 0 means "never loaded". */
  fetchedAt: number;
  /** True while a (foreground or background) refresh is in flight. */
  refreshing: boolean;
  /** Message of the last failed load; cleared on the next success. */
  error: string | null;
}

/**
 * Keyed stale-while-revalidate cache.
 *
 * `read` never blocks once a key has any data: a fresh entry is returned as-is, a
 * stale one is returned immediately while a refresh runs behind it, and only a
 * cold key waits for the first load. Concurrent refreshes of one key collapse to
 * a single upstream call (the `refreshing` guard).
 *
 * The cached `data` is handed back by reference (callers read `.data` directly and
 * may patch it via `mutate`), so a consumer that needs an isolated copy — e.g.
 * before filtering/sorting — must clone it itself.
 */
export class SwrCache<K, T> {
  private readonly entries = new Map<K, SwrEntry<T>>();

  /**
   * @param ttl   per-key freshness window in ms.
   * @param empty factory for the initial `data` of a cold key (e.g. `() => []`).
   */
  constructor(
    private readonly ttl: (key: K) => number,
    private readonly empty: () => T,
  ) {}

  /** The raw entry for status/debug and cross-key aggregation; `undefined` if never touched. */
  peek(key: K): SwrEntry<T> | undefined {
    return this.entries.get(key);
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  private cold(): SwrEntry<T> {
    return { data: this.empty(), fetchedAt: 0, refreshing: false, error: null };
  }

  /**
   * Stale-while-revalidate read. Rejects only when a **cold** key's first load
   * fails (a stale key's failing background refresh is swallowed — the stale
   * payload is still served). Use `readSafe` when the caller must never throw.
   */
  async read(key: K, load: () => Promise<T>): Promise<SwrEntry<T>> {
    const entry = this.entries.get(key);
    const fresh = entry && Date.now() - entry.fetchedAt < this.ttl(key);

    if (entry && entry.fetchedAt > 0) {
      if (!fresh && !entry.refreshing) {
        this.refresh(key, load).catch(() => {
          /* stale data is still served; the error lands on the entry */
        });
      }
      return entry;
    }

    await this.refresh(key, load);
    return this.entries.get(key) ?? this.cold();
  }

  /**
   * Like `read`, but never rejects. On a cold-load failure it returns the (empty)
   * entry with `fetchedAt` still 0, so the next call retries instead of caching
   * the failure for a TTL — the right behaviour for a snapshot that a client polls.
   */
  async readSafe(key: K, load: () => Promise<T>): Promise<SwrEntry<T>> {
    try {
      return await this.read(key, load);
    } catch {
      return this.entries.get(key) ?? this.cold();
    }
  }

  /**
   * Force a load, guarded so concurrent calls for one key collapse to one. Stores
   * the result (clearing any error) on success; on failure records the message on
   * the entry, leaves `fetchedAt` untouched, and rethrows. Use for warm-on-boot.
   */
  async refresh(key: K, load: () => Promise<T>): Promise<void> {
    const existing = this.entries.get(key);
    if (existing?.refreshing) return;

    if (existing) existing.refreshing = true;
    else this.entries.set(key, { data: this.empty(), fetchedAt: 0, refreshing: true, error: null });

    try {
      const data = await load();
      this.entries.set(key, { data, fetchedAt: Date.now(), refreshing: false, error: null });
    } catch (error: any) {
      const entry = this.entries.get(key);
      if (entry) {
        entry.refreshing = false;
        entry.error = error?.message ?? String(error);
      }
      throw error;
    }
  }

  /** Patch a cached entry's `data` in place (mutation write-through). No-op if the key is absent. */
  mutate(key: K, fn: (data: T) => void): void {
    const entry = this.entries.get(key);
    if (entry) fn(entry.data);
  }

  /** Iterate the live entries (e.g. to apply a delete across every scope). */
  forEach(fn: (entry: SwrEntry<T>, key: K) => void): void {
    this.entries.forEach(fn);
  }
}

/**
 * Plain memoize-with-expiry: block on a miss, serve the cached value until it
 * ages out, then load again. No background refresh and no stale serving — the
 * right tool for cheap-to-recompute reference data (driver/geozone registries).
 */
export class TtlCache {
  private readonly store = new Map<string, { data: unknown; at: number }>();

  constructor(private readonly ttlMs: number) {}

  async wrap<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.data as T;
    const data = await load();
    this.store.set(key, { data, at: Date.now() });
    return data;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * In-flight request de-duplication. While a promise for `key` is pending, every
 * caller with the same key gets that same promise instead of starting a new
 * upstream call; the entry is dropped when it settles. Several dispatchers
 * polling one truck on the same clock therefore share a single request.
 */
export class InflightMap<T> {
  private readonly map = new Map<string, Promise<T>>();

  run(key: string, factory: () => Promise<T>): Promise<T> {
    const inflight = this.map.get(key);
    if (inflight) return inflight;

    const request = factory().finally(() => this.map.delete(key));
    this.map.set(key, request);
    return request;
  }
}
