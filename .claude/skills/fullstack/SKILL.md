---
name: fullstack
description: Engineering conventions for this Next.js 14 + NestJS fuel-ERP codebase — API client layer, page/data-fetching patterns, vendor adapter rules, unit conversions, state, and what to verify before calling work done. Use when adding endpoints, pages, components, or touching backend vendor services.
---

# Fullstack conventions — VELES ERP

Next.js 14 App Router (`frontend/`, port 3000) + NestJS 10 (`backend/`, port 3001).
Ukrainian UI. No test suite — verification is `npm run build` on both sides plus a manual pass.

## Frontend

### Never hardcode the API host

`http://localhost:3001` used to be inlined in ~11 files. There is now one place:

```ts
// src/lib/api.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export async function apiGet<T>(path: string, params?: Record<string, string|undefined>): Promise<T>
export async function apiSend<T>(method, path, body?): Promise<T>
```

All fetching goes through it. Adding a literal backend URL to a component is a regression.

### Page shape

Every authenticated page is `'use client'` and follows the same skeleton:

```tsx
const { authenticated } = useAuthGuard();      // redirects to /login when no token
const [state, setState] = useState(...);
const load = useCallback(async () => { ... }, [deps]);
useEffect(() => { if (authenticated) load(); }, [authenticated, load]);

return (
  <PageShell title="…" subtitle="…" onRefresh={load} isRefreshing={…}
             activeBrand={brand} onSelectBrand={setBrand}
             currentRange={range} onDateChange={setRange}>
    {loading ? <Skeleton…/> : <Content…/>}
  </PageShell>
);
```

`PageShell` owns sidebar + topbar + brand tabs + date picker. Pages own data only. Do not
re-implement the chrome in a page.

### Response shapes differ per endpoint — check before mapping

Collection endpoints (`/api/cards`, `/api/merchants`, `/api/transactions`) return
`{ items, total, page, size, totalPages }`. `/api/contracts` and the analytics endpoints
return bare arrays. Treating a paginated response as an array yields a silently empty screen —
this bug shipped once already on the cards page. Use the `unwrapList()` helper in `src/lib/api.ts`,
which accepts either shape.

### Errors are invisible by default

Backend vendor calls swallow failures and return `[]` with HTTP 200. So "no data" never
throws. When a view can be empty for boring reasons, say so in the empty state rather than
rendering a blank panel.

### Client-side rules

- Anything touching `window` (Leaflet, three.js) must be `next/dynamic` with `ssr: false`.
- Theme comes from `useTheme()` in `src/context/ThemeContext.tsx` — single source, single
  storage key. Never write a second theme toggle with its own `localStorage` key.
- Charts must read colors from CSS variables at render time so they follow the theme.
- Money/volume formatting: `Intl.NumberFormat('uk-UA', …)`; never hand-rolled string math.

## Backend

### Vendor adapters are the boundary

`src/<vendor>/<vendor>-api.service.ts` is the only file allowed to know a vendor's wire
format. Controllers consume the normalized interface. If a controller contains a PascalCase
field name or a `/100`, it is in the wrong layer.

### Conversions live in the adapter, once

- **OKKO**: money in kopiykas (`/100`), volume in millilitres (`/1000`), unit price is
  *derived* (`amount / volume`) — the API's own price field is unreliable. Max 30-day query
  window, clamped in `formatAndClampOkkoDates()`.
- **Shell**: `YYYYMMDD` dates, POST bodies, PascalCase fields. Cards and merchants are
  *derived* by de-duplicating the transaction list — there is no cards endpoint in use.
- **Ruptela**: REST for telemetry (`/objects-last-coordinate` — one batched call for the whole
  fleet, never per-vehicle), GraphQL (`/routing`) for trip CRUD, 60s stale-while-revalidate
  cache. Trip mutations fall back to an in-memory store, so created trips do not survive a
  restart — say so in the UI rather than implying persistence.

### Config and secrets

Read credentials via `ConfigService` with the key in `.env`. Do not add new inline fallback
secrets to constructors — several already exist and are a liability (the repo has no
`.gitignore`). When you touch such a constructor, move the value to `ConfigService`.

### Adding an endpoint

1. Method on the vendor service returning a normalized, typed shape.
2. Controller route under `api/<resource>`, `brand` query param if it spans vendors.
3. In-memory pagination via the same `{items,total,page,size,totalPages}` envelope.
4. Wrap the vendor call in try/catch → log → return empty. Consistency beats cleverness here.

## Definition of done

- `cd frontend && npm run build` passes (type errors are build errors here).
- `cd backend && npm run build` passes.
- Both themes checked if UI changed.
- No new hardcoded API host, no new raw-palette Tailwind class, no new inline secret.
- If something in scope was left out, say which part and why — do not quietly narrow scope.
