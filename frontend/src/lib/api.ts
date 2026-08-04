/**
 * Single source of truth for backend access.
 * Previously the host was hardcoded in ~11 files; keep it here only.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

type QueryValue = string | number | boolean | undefined | null;

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.append(key, String(value));
  }
  const query = qs.toString();
  return query ? `${url}?${query}` : url;
}

/**
 * The session token rides on every request. The backend ignores it everywhere except
 * `ReadOnlyGuard`, which uses it to reject writes from a guest session — so dropping
 * this header would let a guest through the server-side ban.
 */
function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('veles_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Nest sends `{ statusCode, message, error }` on failure, and upstream vendor
 * text (Ruptela's GraphQL validation, for instance) arrives in `message`.
 * Surface that verbatim — a bare status code tells the dispatcher nothing.
 */
async function toError(res: Response, method: string, path: string): Promise<Error> {
  let detail = '';
  try {
    const body = await res.json();
    const message = body?.message;
    detail = Array.isArray(message) ? message.join('; ') : (message ?? body?.error ?? '');
  } catch {
    /* non-JSON error body */
  }
  return new Error(detail || `${method} ${path} → HTTP ${res.status}`);
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, QueryValue>,
): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  if (!res.ok) throw await toError(res, 'GET', path);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res, method, path);
  return res.json() as Promise<T>;
}

/**
 * Collection endpoints return `{ items, total, ... }`; a few return a bare array.
 * Treating one as the other silently renders an empty screen — always unwrap here.
 */
export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as any).items)) {
    return (payload as any).items as T[];
  }
  return [];
}

/** GET a collection endpoint tolerantly — never throws, returns [] on failure. */
export async function apiList<T>(
  path: string,
  params?: Record<string, QueryValue>,
): Promise<T[]> {
  try {
    return unwrapList<T>(await apiGet<unknown>(path, params));
  } catch {
    return [];
  }
}

/** GET a single object tolerantly — never throws, returns null on failure. */
export async function apiObject<T>(
  path: string,
  params?: Record<string, QueryValue>,
): Promise<T | null> {
  try {
    return await apiGet<T>(path, params);
  } catch {
    return null;
  }
}
