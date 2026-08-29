import { SwrCache, TtlCache, InflightMap } from './swr-cache';

/** Controls Date.now() so TTL behaviour is deterministic without real timers. */
function fakeClock(start = 1_000) {
  let t = start;
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => t);
  return {
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
    restore: () => spy.mockRestore(),
  };
}

const tick = () => new Promise((r) => setImmediate(r));

describe('SwrCache', () => {
  let clock: ReturnType<typeof fakeClock>;
  beforeEach(() => {
    clock = fakeClock();
  });
  afterEach(() => clock.restore());

  it('blocks on the cold read, then serves the fresh value without reloading', async () => {
    const load = jest.fn().mockResolvedValue([1, 2, 3]);
    const cache = new SwrCache<'k', number[]>(() => 1000, () => []);

    const first = await cache.read('k', load);
    expect(first.data).toEqual([1, 2, 3]);
    expect(first.fetchedAt).toBeGreaterThan(0);
    expect(load).toHaveBeenCalledTimes(1);

    clock.advance(500); // still within TTL
    const second = await cache.read('k', load);
    expect(second.data).toEqual([1, 2, 3]);
    expect(load).toHaveBeenCalledTimes(1); // no reload
  });

  it('serves stale data immediately and refreshes in the background once TTL passes', async () => {
    const load = jest.fn().mockResolvedValueOnce(['old']).mockResolvedValueOnce(['new']);
    const cache = new SwrCache<'k', string[]>(() => 1000, () => []);

    await cache.read('k', load);
    clock.advance(2000); // now stale

    const stale = await cache.read('k', load); // returns old synchronously-ish
    expect(stale.data).toEqual(['old']);
    await tick(); // let the background refresh settle
    expect(load).toHaveBeenCalledTimes(2);

    const fresh = await cache.read('k', load);
    expect(fresh.data).toEqual(['new']);
  });

  it('collapses concurrent refreshes of one key into a single load', async () => {
    let resolve!: (v: number[]) => void;
    const load = jest.fn().mockImplementation(() => new Promise<number[]>((r) => (resolve = r)));
    const cache = new SwrCache<'k', number[]>(() => 1000, () => []);

    const a = cache.read('k', load);
    const b = cache.read('k', load);
    resolve([9]);
    await Promise.all([a, b]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('read() rejects when the cold load fails; readSafe() does not and keeps retrying', async () => {
    const boom = new Error('upstream down');
    const load = jest.fn().mockRejectedValueOnce(boom).mockResolvedValueOnce([42]);
    const cache = new SwrCache<'k', number[]>(() => 1000, () => []);

    await expect(cache.read('k', load)).rejects.toThrow('upstream down');

    // fetchedAt stayed 0 → the entry is still cold, so readSafe retries the load.
    const recovered = await cache.readSafe('k', load);
    expect(recovered.data).toEqual([42]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('mutate() patches cached data in place and forEach() visits every entry', async () => {
    const cache = new SwrCache<'a' | 'b', number[]>(() => 1000, () => []);
    await cache.read('a', async () => [1]);
    await cache.read('b', async () => [2]);

    cache.mutate('a', (d) => d.push(99));
    expect(cache.peek('a')?.data).toEqual([1, 99]);

    const seen: number[][] = [];
    cache.forEach((e) => seen.push(e.data));
    expect(seen).toEqual(expect.arrayContaining([[1, 99], [2]]));
  });
});

describe('TtlCache', () => {
  let clock: ReturnType<typeof fakeClock>;
  beforeEach(() => {
    clock = fakeClock();
  });
  afterEach(() => clock.restore());

  it('memoizes until the entry expires, then reloads', async () => {
    const load = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const cache = new TtlCache(1000);

    expect(await cache.wrap('k', load)).toBe('v1');
    clock.advance(500);
    expect(await cache.wrap('k', load)).toBe('v1'); // still fresh
    expect(load).toHaveBeenCalledTimes(1);

    clock.advance(600); // now past TTL
    expect(await cache.wrap('k', load)).toBe('v2');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('delete() forces the next call to reload', async () => {
    const load = jest.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const cache = new TtlCache(10_000);
    expect(await cache.wrap('k', load)).toBe('a');
    cache.delete('k');
    expect(await cache.wrap('k', load)).toBe('b');
  });
});

describe('InflightMap', () => {
  it('shares one promise for identical concurrent keys and clears it after settling', async () => {
    let resolve!: (v: string) => void;
    const factory = jest.fn().mockImplementation(() => new Promise<string>((r) => (resolve = r)));
    const map = new InflightMap<string>();

    const a = map.run('k', factory);
    const b = map.run('k', factory);
    expect(factory).toHaveBeenCalledTimes(1); // deduped

    resolve('done');
    expect(await a).toBe('done');
    expect(await b).toBe('done');

    // settled → a fresh run starts a new call
    await map.run('k', jest.fn().mockResolvedValue('again'));
    const factory2 = jest.fn().mockResolvedValue('x');
    await map.run('k', factory2);
    expect(factory2).toHaveBeenCalledTimes(1);
  });
});
