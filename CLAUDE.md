# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fleet-fuel ERP dashboard for ТОВ "Велес Буковина". A NestJS backend proxies several external
vendor APIs — OKKO fuel cards, Shell Mobility B2B cards, Ruptela/fm-track telematics (+ its
Routing & Tasking GraphQL), Nova Poshta parcels — and normalizes them into one shape; it also
talks to an on-prem **Oracle** database for delivery-date write-back. A Next.js App Router
frontend renders the dashboard. UI text is authored in Ukrainian and translated at runtime
into English, Polish and German — write new user-facing strings in Ukrainian and wrap them in
`t()` (see *Localisation* below).

Git repository (`main`). Backend tests run on Jest (`npm test`); the frontend has no test
suite yet, and no linter config beyond `next lint`.

### Architecture direction (decided)

The frontend is **mid-migration to Feature-Sliced Design (FSD)** and the chosen direction is
to **finish that migration**, not to keep two paradigms. The marketing surface already lives
in FSD layers (`screens/` → `widgets/` → `shared/`); the workflow (ERP) surface is still on
the legacy flat layout (`components/`, `lib/`, `context/`, `utils/`) and is being moved into
`features/` incrementally. Rules for anything new or touched:

- **New workflow feature** → a slice under `features/<feature>/` with `ui/` (components) and
  `model/` (hooks, data-fetching, state). A route file under `app/workflow/<feature>/page.tsx`
  should be a thin composition that imports from its slice — target ≤ ~200 lines.
- **Shared, feature-agnostic code** → `shared/` (`shared/lib` for hooks/utilities,
  `shared/ui` for primitives, `shared/config` for static data/content).
- **Do not add new files to the flat `components/` / `lib/` grab-bag.** Existing files there
  migrate opportunistically when a task already touches them.
- The dependency rule points one way: `app` → `features` → `widgets` → `shared`. A `shared`
  module must never import from `features`.

## Commands

Backend (`backend/`, NestJS, listens on **3001**):
```
npm run start:dev      # watch mode — the normal dev loop
npm run build          # nest build -> dist/
npm run start:prod     # node dist/main
npm test               # jest — unit tests for the pure mappers + cache primitives
npm run format         # prettier over src/**/*.ts
```
Tests are Jest specs colocated as `*.spec.ts` (excluded from the build). `GET /api/health`
reports which vendors are configured. CI (`.github/workflows/ci.yml`) runs the backend
build+test and a frontend `tsc --noEmit` + `i18n:check` on every push/PR.

Frontend (`frontend/`, Next.js 14, listens on **3000**):
```
npm run dev
npm run build
npm run lint
```

Root orchestrator (`package.json` at the repo root — no deps, just delegates to the two
apps for deploys): `npm run build` builds both (backend `dist/` + frontend `.next/`),
`npm run deploy` = build + `pm2 restart all`, `npm run deploy:reload` = build +
`pm2 startOrReload ecosystem.config.js` (scoped, zero-downtime). PM2 processes are defined in
`ecosystem.config.js` (backend :7001, frontend :7002); see `DEPLOY.md`.

Both must run for the app to work. The backend host lives in one place —
`src/lib/api.ts` (`NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001`). Do not
reintroduce hardcoded hosts in components.

Note: `next build` and `next dev` share `.next`. Running a build while the dev server is up
corrupts its chunks (`Cannot find module './230.js'`). Stop dev, `rm -rf .next`, then build.

## Architecture

### Backend: vendor adapters + thin aggregating controllers

`src/<vendor>/<vendor>-api.service.ts` are the only places that talk to an external API.
Everything else consumes their normalized TypeScript interfaces.

**Pure mapping is being split into `<vendor>/<vendor>.mapper.ts`** — the normalized
interfaces, unit conversions, dictionaries and per-row `map*` functions, with no axios/Nest
dependency so they are unit-tested in isolation (`*.mapper.spec.ts`). Done for **OKKO**
(`okko.mapper.ts`: kopiykas/millilitre conversions, derived price, `parseTransactionType`,
CHST dictionary) and **Shell** (`shell.mapper.ts`: `YYYYMMDD`→ISO, PascalCase→snake_case,
`parseShellTransactionType`, card/merchant derivation). The `*-api.service.ts` keeps only the
HTTP client, auth, caching and orchestration, and re-exports the mapper's types for
backward compatibility. Apply the same split to the remaining heavy vendors (Ruptela,
Nova Poshta) when a task touches their mapping.

- **`okko/okko-api.service.ts`** — REST against `gw-online.okko.ua:9443/api/erp/v2/*` with
  `X-API-KEY` and `rejectUnauthorized: false` (their cert fails validation). Two unit
  conversions live here and must not be duplicated downstream: OKKO returns **money in
  kopiykas** (`/100`) and **volume in millilitres** (`/1000`). Unit price is *derived*
  (`amount / volume`), not taken from the response. `parseTransactionType()` maps OKKO
  numeric codes (774/775/783/787/737) to Ukrainian descriptions and an `is_return` flag.
  `formatAndClampOkkoDates()` enforces the vendor's **30-day max range** by pulling
  `date_from` forward — a wider requested range is silently clamped, not rejected.
- **`shell/shell-api.service.ts`** — POST-based `api-test.shell.com/test` (the **test**
  environment; production credentials were never supplied). Only
  `pricedtransactions` returns real data; `getCards()` and `getShellMerchants()` are
  *derived* by de-duplicating the transaction list by `CardPAN` / `SiteCode`. Dates go out
  as `YYYYMMDD` and come back the same way — `toIsoDate()` normalises them on the way in, or
  they land in the analytics date grouping as `20260608` beside OKKO's ISO keys and break
  the chart axis.
- **`ruptela/ruptela-api.service.ts`** — REST against `api.fm-track.com`. **Every telemetry
  field is real; absent readings are `null`, never a placeholder.** Assembling one fleet
  snapshot takes three different endpoints, because no single one carries it all:
  - `/objects-last-coordinate?version=2` — one batched call, but **position only**
    (lat/lng, speed, direction, altitude, satellites). No ignition, fuel, or odometer.
  - `/objects/{id}/coordinates?version=2` — per vehicle, the only source of CAN data
    (`inputs.device_inputs` / `inputs.calculated_inputs`): ignition, RPM, engine hours,
    `canbus_distance` (km), `fuel_level` (L), `fuel_level_can` (%), coolant, voltages.
    Records come back **oldest-first**, so the window is anchored on the vehicle's last
    fix and the *last* item is taken. Keep the window small (~6 min) — a 30 min window
    returns up to 100 records per vehicle.
  - `/objects/{id}/trips` + `/drivers/{id}` — there is no vehicle→driver endpoint, so the
    driver is resolved from the most recent trip's `driver_ids`. `/drivers` does not list
    every driver, so unknown ids need the per-id lookup. Some drivers are genuinely
    registered under a tachograph card number rather than a name.

  **The API rate-limits (nginx 429).** At concurrency 8 it rejected ~2/3 of the per-vehicle
  calls, which silently blanked the CAN columns. Fan-out is capped at 3 with `getWithRetry()`
  backing off on 429; a throttled request must never be treated as "no data". The assembled
  snapshot is cached 30 s with stale-while-revalidate so the page's 5 s polling does not
  become ~65 upstream calls a tick.

  `getVehicleTrack()` (→ `GET /api/ruptela/vehicles/:id/coordinates`) is the exception to the
  snapshot rule: it backs the real-time watch screen, so it hits
  `/objects/{id}/coordinates?version=2` on **every** call for a single vehicle. Position and
  CAN arrive in the same record there — note the shape differs from
  `/objects-last-coordinate`, where position is flat rather than nested under `position`.
  The vendor pages with a datetime `continuation_token` (max `limit` 1000); when a window
  holds more records than asked for, the **newest** are kept. Callers should pass the newest
  timestamp they already hold as `from` so a 5 s poll transfers a couple of records instead of
  the whole window — `from_datetime` is inclusive, so the anchor record repeats and the client
  dedupes by `datetime`. Identical concurrent requests share one upstream call
  (`inflightTracks`), because several dispatchers watching one truck poll on the same clock.

  Fields the hardware does not report at all: door status and reefer temperatures (these are
  tractors), driver phone, and vehicle year. Do not reintroduce them.
  Coolant reads `0` whenever the engine is off — that is "no reading", surfaced as `null`.

- **`ruptela/ruptela-routing.service.ts`** — the *Routing & Tasking* GraphQL API
  (`POST /routing?api_key=…`), kept separate from telemetry. Reference PDF:
  `common/Ruptella - Api/RnT-GraphQL-API-Reference-A3 (1).pdf` (extract text with
  `pdftotext -layout`). Two properties of this API shape everything:

  - **`tripList` has no pagination and no date filter** — only `states` and `title`.
    Measured: all four original states + full route = **31 s / 146 KB / 89 trips**; the six
    *active* states with the same projection = **4 s / 29 KB / 11 trips**. So trips are
    fetched as two scopes: `active` (NEW, SENT_TO_DRIVER, SEEN, ACCEPTED, IN_PROGRESS,
    ON_HOLD), warmed at boot and cached 30 s, and `archive` (COMPLETED, CANCELED), fetched
    only when requested and cached 15 min. Both are stale-while-revalidate, so a request
    never waits once anything is cached. `GET /api/ruptela/trips` defaults to `active`.
  - **GraphQL answers HTTP 200 even when the operation failed** — the failure sits in the
    `errors` array. A try/catch around axios therefore reports success for every rejected
    mutation, which is exactly why the previous implementation appeared to write to Ruptela
    while it only ever wrote to an in-memory array. `graphql()` throws on `errors`; never
    bypass it.

  Mutation facts worth keeping: `TripCreateParameters.id` is **mandatory and must be a
  UUID** (the old `trip-rup-<timestamp>` ids were rejected); `InputLocation` needs either a
  lat/lon pair or an address; `cargoWeight` is only accepted on LOADING/UNLOADING;
  `notifyDrivers` defaults to false here so creating a trip does not page a driver.
  `Metadata` exposes `distance` but not `duration`, and `RouteStatistics` nests values under
  `plannedTotal`/`actualTotal` — asking for the wrong field fails the whole query.
  There is **no `getTrip(id)` query**, so a single trip is resolved out of the cached lists.
  There is **no mutation for waypoint-todo completion**, so ticking a checklist item is a
  dispatcher-local flag, returned with `local_only: true`. Mutations patch the cache
  directly, so a created/edited trip shows up without waiting for a refetch.

- **`novaposhta/novaposhta-api.service.ts`** — the Nova Poshta JSON API (parcel courier).
  Tracks parcels (`track`), lists the account's own waybills by date range (`shipments`),
  searches cities/warehouses, resolves the sender from the API key, and **creates express
  waybills** (`POST /api/novaposhta/shipments`, blocked for guest by `ReadOnlyGuard` because
  it writes to the live account). Dates go out as `DD.MM.YYYY`. Delivered states are `StateId`
  9/10/11. **Movement history:** the live `getStatusDocuments` response carries **no**
  `TrackingUpdateHistory` array (verified against a real TTN) — only a flat current status plus
  assorted date fields. So `track()` maps `TrackingUpdateHistory` when a proxy/mock supplies it,
  otherwise **synthesizes** a coarse timeline (`synthesizeHistory`) from the dates NP does return:
  Створено (`DateCreated`) → [В дорозі (`DateMoving`)] → Прибув у відділення (`ActualDeliveryDate`)
  → Отримано (`RecipientDateTime`). Two traps live here: those date fields come back in **mixed
  formats** on different keys (`DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`, even `HH:MM DD.MM.YYYY`) —
  parse via `parseFlexibleNpDate` and re-emit a normalized `YYYY-MM-DD HH:MM:SS` so the frontend
  can format it; and **`ActualDeliveryDate` is the branch-arrival time, not the hand-over** — the
  actual pickup is `RecipientDateTime`, so they are two distinct steps. NP exposes no per-hub scan
  trace via the API, so this is as full as it gets without recording status snapshots over time.
  `listShipments` **embeds** each waybill's `history` (and `state_id`) by batch-tracking the whole
  page in one `getStatusDocuments` call, so the `/workflow/novaposhta/shipments` list shows the
  delivery-phase graph inline and the movement timeline on expand with **no per-row request** —
  a tracking failure degrades to an empty history, never a failed list.
- **`novaposhta/novaposhta-sync.service.ts`** — a `@Cron('0 0 */3 * * *')` job (every 3 h,
  warmed 10 s after boot) that pulls **our** shipments for the last **40 days**, keeps the
  delivered ones, and calls the Oracle `SetDateDelivered` procedure for each. The 40-day window
  is deliberately wider than the 3-h step so a missed tick self-heals, and the procedure is
  idempotent. An
  in-process `running` flag prevents overlapping ticks; multi-instance would need a leader lock.
  The last run (when, window, collected/written, duration, ok/error) plus the `running` flag are
  kept in memory and surfaced at `GET /api/novaposhta/sync-status`, which the
  **`/workflow/sync/novaposhta`** page polls (every 20 s). There is no per-item progress — it is
  one batch call, so the page shows last-run status, not a live table like GPS.
- **`oracle/oracle.service.ts`** — the **pure Oracle access layer** (`node-oracledb`, THIN
  mode, no Instant Client), lazy connection pool (`poolMax: 4`). Imported with `import oracledb
  = require('oracledb')` because `esModuleInterop` is off. It exposes only generics — `query()`
  (SELECT → objects) and `withConnection(fn)` (borrow a pooled connection for a transaction) —
  and **holds no business SQL**. Every feature keeps its SQL in a repository next to its code:
  `oracle/os.repository.ts` (`getOs`, the `os` demo), `novaposhta/deliveries.repository.ts`
  (`setDeliveredBatch` — the delivery-date `executeMany`), `gps/gps.repository.ts` (below). Add
  a repository, not a method on OracleService. Oracle keys come back UPPERCASE; repositories
  normalise them. No secrets in code — `ORACLE_USER` / `ORACLE_PASSWORD` /
  `ORACLE_CONNECT_STRING` from env, missing → vendor disabled with a warning.
- **`contracts/contracts.controller.ts`** — thin passthrough to `OkkoApiService.getContracts()`
  (OKKO is the only vendor exposing contract metadata); it owns no service of its own.
- **`gps/gps-sync.service.ts`** — periodic GPS-history sync **Ruptela coordinates → Oracle
  `p_gps.AddGps`**. A `@Cron('0 * * * * *')` cycle (running-guard, warmed after boot) walks the
  vehicle list from `GpsRepository.getVehicles()` (the `tz`/`gpsprov` join; `datlast =
  to_char(max(dat))`) **one vehicle at a time** — Ruptela rate-limits (429), so no fan-out.
  Per vehicle it reads the **oldest** ≤`GPS_SYNC_LIMIT` (999) points after `datlast` via
  `RuptelaApiService.getRawCoordinates()` (raw items — keeps the ecodrive/CAN fields
  `mapTrackPoint` drops), maps them in `gps.mapper.ts` (types in `gps.types.ts`), and writes
  each through `GpsRepository.addGpsBatch()` (the `p_gps.AddGps` block + binds live in the
  repository; OracleService only lends the connection). A backlog catches up over successive
  passes. **Timezone:**
  Oracle stores points in local wall-clock (UTC+`RUPTELA_TZ_OFFSET_HOURS`, default 3), Ruptela
  speaks UTC — dates cross the boundary as **strings** (`TO_DATE` in the block, `TO_CHAR` on
  read) so it is process-TZ-independent, matching the old Pascal `lDatFrom - 3h + 1s`. Gated by
  `GPS_SYNC_ENABLED` (writes to the live DB). If Ruptela is **unreachable** (a network-level
  error, not a 429 or an HTTP error with a body), the cycle stops and backs off for
  `RUPTELA_RETRY_COOLDOWN_MIN` (default 10) minutes instead of retrying every minute. Live
  per-vehicle progress is kept in memory and surfaced at `GET /api/gps/progress` (+
  `POST /api/gps/sync` to run a pass; blocked for guest), which the
  **`/workflow/sync/gps`** page polls (every 20 s) to visualise the ingest (no manual-run
  button — the cron keeps it going and the page shows the cooldown when Ruptela is down).
  The old `/workflow/ruptela/realtime-coordinates` URL now redirects here.

Cross-vendor endpoints (`transactions`, `cards`, `merchants`, `analytics`) take a
`brand=ALL|OKKO|SHELL` query param, fan out to the relevant services, map Shell's PascalCase
fields onto the OKKO snake_case shape, concatenate, then **paginate in memory**
(`{ items, total, page, size, totalPages }`) — the vendors' own paging is not used.

Every vendor call is wrapped in try/catch that logs and **returns an empty array**. A dead
upstream therefore surfaces as zeroed KPIs, never an error response — check backend logs,
not HTTP status, when data looks missing.

**Caching primitives live in `common/swr-cache.ts`** — do not hand-roll a fourth copy. Three
shapes are provided and used across the Ruptela services: `SwrCache<K,T>` (keyed
stale-while-revalidate with a `refreshing` guard, error retention, `read`/`readSafe`/`refresh`/
`mutate`/`peek`) backs the routing active/archive trips and the fleet snapshot; `TtlCache`
(plain memoize-with-expiry) backs the insights registries; `InflightMap` (in-flight
de-duplication) backs the live-track requests. Two cold-miss policies exist on purpose:
routing blocks until the first successful load, while the fleet snapshot blocks **at most
once** (its `getVehicles` peeks first, so an outage never hangs the 5 s-polling page) — keep
that distinction if you touch either.

`auth/auth.controller.ts` is a stub: credentials come from env (`AUTH_ADMIN_USER` /
`AUTH_ADMIN_PASSWORD`; passwordless demo logins `okko`/`shell`/`demo` only when
`AUTH_DEMO_ENABLED=true`), and the "token" is still `veles_session_<ms>_<ROLE>` —
minted and parsed only in `auth/session.ts`. No route requires authentication.

The one thing that token *is* trusted for is the **guest role**. `guest`/`guest`
(public, printed on the login screen, disabled with `AUTH_GUEST_ENABLED=false`) logs in
as `GUEST`, and `auth/read-only.guard.ts` — registered as a global `APP_GUARD` — rejects
every non-GET request carrying a `_GUEST` token with 403, except `/api/auth/*`. Hiding
the UI would not be enough: a trip created from the dashboard is written to Ruptela's
live Routing & Tasking API and can be pushed to a real driver. This is also why
`frontend/src/lib/api.ts` now sends `Authorization: Bearer <token>` on every request —
drop that header and the server-side ban stops working. The frontend mirror is
`isGuestUser()` / `permissionsOf()` in `src/lib/useAuthGuard.ts` (`useSessionUser()` for
chrome that must not redirect); guest-facing copy lives in `components/GuestLock.tsx`.

### Frontend: route groups + page-level fetching through a thin lib layer

`src/app/` is split into two route groups with different jobs — and, currently, two
different architectures (see *Architecture direction* above):

- **`(marketing)/`** — the public landing / calculator / expenses / future-plans /
  integrations pages. Already on **FSD**: each route file is a thin wrapper around a
  `screens/<name>` slice, which composes `widgets/` and `shared/`.
- **`workflow/`** — the authenticated ERP app (dashboard, cards, transactions, analytics,
  merchants, the amber `ruptela/*` telematics section, `novaposhta/*`, `oracle`, the API
  docs/console, the `ui-kit` gallery). Still on the **legacy flat layout**; being migrated to
  `features/` per the direction above. The `workflow/` URL prefix is real — links and the
  command palette use `/workflow/...`. The **«Синхронізація з базою»** section
  (`workflow/sync/{gps,novaposhta}`, its own sidebar group above the fleet) is the first slice
  landed under FSD: `features/sync/` with `ui/` (`SyncShell` + the two views) and `model/`
  (`usePolledStatus` — a 20 s poller, `types.ts`); the route files are thin. Both views are
  Ukrainian-only ops screens (in the i18n `EXCLUDE`); only the shell tabs / sidebar labels are
  translated (`sync.*`, `nav.dbSync`).

Every page under `src/app/` is a `'use client'` component. The shared pieces:

- `src/shared/contracts/` — the **single source of truth** for the normalized API shapes the
  frontend consumes (`ruptela.ts`, `novaposhta.ts`), mirroring the NestJS adapters. Pure types
  only; `@/lib/ruptela` and `@/lib/novaposhta` import from here and re-export, so the shapes are
  defined once. Runtime (label maps, formatters, fetch helpers) stays in `lib/`. There is no
  cross-process package (kept deliberately simple): backend and frontend still hold parallel
  copies, so a shape change is a two-file edit — this module is where the frontend half lives.
- `src/lib/api.ts` — `apiGet` / `apiSend` / `apiList` / `apiObject` / `unwrapList`.
  `apiList` tolerates *both* response shapes: collection endpoints (`/api/cards`,
  `/api/merchants`, `/api/transactions`) return `{items,total,page,size,totalPages}`, while
  `/api/contracts` and the analytics routes return bare arrays. Treating one as the other
  silently renders an empty screen — that bug had blanked the cards page.
- `src/lib/apiCache.ts` — `cachedList` / `cachedObject`, stale-while-revalidate over
  `apiGet`. The five vendor-backed pages (dashboard, cards, transactions, analytics,
  merchants) go through **this**, not `apiList`/`apiObject` directly: OKKO and Shell take
  ~13 s for a wide date range, so every visit used to be a fresh skeleton. Cache hit
  younger than 30 s → no network at all; older but under 12 h → the stale copy paints
  immediately and an `onFresh` callback pushes the new data in when it lands. Entries are
  keyed by path + sorted params (so `{brand,size}` and `{size,brand}` are one entry) and
  persisted in `localStorage` under `veles_cache_v1:` so a cold tab is instant too;
  identical concurrent requests share one fetch. Manual «Оновити» passes `force: true`.
  `useApiRefreshing()` drives the topbar spinner while a background revalidation runs.
  Deliberately **not** cached: `/api/ruptela/vehicles/:id/coordinates` — a stale truck
  position is worse than a spinner. `signOut()` calls `clearApiCache()`, otherwise the next
  person to sign in on that machine sees the previous session's data before the first
  response.
- `src/lib/useAuthGuard.ts` — the session gate every page uses.
- `src/lib/format.ts` — `uk-UA` currency/number/date formatters.
- `components/PageShell.tsx` — sidebar + sticky topbar + brand tabs + date picker.
  `components/RuptelaShell.tsx` — the same for the amber telematics section.
  Pages own data; they should not re-implement chrome.

Shared per-page state (`activeBrand`, `DateRange`) is still local `useState` prop-drilled
into the shell.

`context/TourContext.tsx` + `components/OnboardingTour.tsx` are the onboarding tour: it is
offered once per browser (`veles_tour_v1` = `done` | `declined`) and afterwards started from
the «Навчання» button in the sidebar or ⌘K. Steps point at `data-tour="…"` attributes rather
than at class names, so restyling the sidebar does not silently break the tour — but
renaming a `data-tour` value does; the step then falls back to a centred card with no
spotlight. Sidebar markup is rendered **twice** (desktop rail + mobile drawer), so the
overlay spotlights the first match that actually has a size. Steps can be marked
`guestOnly` / `staffOnly`.

`/workflow/fleet-demo` (1100+ lines) is a standalone 3D truck-diagnostics view with **local
mock state only** — it never calls the backend (renamed from `/workflow/fleet` so the name no
longer collides with the real telematics view). `/workflow/ruptela/fleet` is the real
telematics view. `/workflow/ruptela/live` watches **one** vehicle: it polls `/coordinates` on a dispatcher-chosen
interval (3/5/10/30 s), keeps an incremental client-side buffer keyed by `datetime`, trims it
to the selected window (15 хв–3 год), and draws the track on `RuptelaLiveTrackMap`. When the
chosen window is empty it widens **once** to 24 h and says so, rather than showing a blank
map for a truck that has been parked overnight.
Both `ThreeTruckViewer` (react-three-fiber) and `RuptelaFleetMap` (Leaflet) are loaded via
`next/dynamic` because they touch `window`; keep any new map/3D component the same way.
Anything using `useSearchParams()` needs a `<Suspense>` boundary or the static export fails.

#### Map settings (`lib/mapPrefs.ts` + `lib/mapRuntime.ts` + `components/MapSettingsPanel.tsx`)

Both Leaflet maps share **one** preferences object — basemap (10 providers incl. Esri
imagery/topo, plus `auto` = follow the app theme), a labels overlay, tile opacity/grayscale/
brightness/contrast, which controls exist (zoom, scale metric/imperial/both, attribution,
fullscreen, locate, cursor coordinates) and interaction (wheel/double-click zoom, dragging,
inertia, keyboard, box zoom, 180° wrap, zoom step). Persisted in `localStorage`
(`veles_map_v1`), normalised on read, and mirrored to other tabs via the `storage` event.

The state lives **outside React** (`getMapPrefs` / `setMapPrefs` / `onMapPrefsChange`),
because the maps are imperative `L.map` instances in refs, not component trees.
`applyMapPrefs(handles, prefs, theme)` is idempotent — it brings any map to the described
state, so both maps run the same code and no setting needs prop-drilling.

Facts that cost time to rediscover:
- Maps **must** be constructed with `attributionControl: true` — that is what makes
  `TileLayer.onAdd` register the provider's credit. Hide it by removing the control, not by
  the option (the option is read only in the constructor). Same for `worldCopyJump`, which
  is reimplemented here as a `moveend` handler.
- Each provider has its own `maxZoom` (OpenTopoMap stops at 17); `map.setMaxZoom()` follows
  the basemap, otherwise the map goes blank past the provider's ceiling.
- No Leaflet plugins — fullscreen/locate/coordinates are hand-rolled `L.Control`s, and
  fullscreen expands the `[data-map-shell]` wrapper (not the Leaflet container) so the
  legend and settings button come along; `invalidateSize()` after the switch is required.
- The panel sits inside `[data-map-shell]`, which has `overflow-hidden` for its rounded
  corners: it is a bounded flex column with `min-h-0` so it shrinks and scrolls instead of
  being clipped, and `pointer-events-none` on the wrapper keeps the map draggable.

### Localisation — Ukrainian source, three target languages

Local, no network, no `/en` routes. Keys are semantic ids — `namespace.name`, the same across
all four dictionaries (`src/locales/{uk,en,pl,de}.json`):

```tsx
t('common.fuelCards')   // Паливні картки · Fuel cards · Karty paliwowe · Tankkarten
```

Namespaces follow the app's sections (`nav`, `auth`, `cards`, `tx`, `analytics`, `merchants`,
`telematics`, `live`, `trip`, `insights`, `diag`, `console`, `tour`, `guest`, `export`, `ui`,
`unit`, `error`), with `common` for strings used across sections. Ukrainian lives in `uk.json`
like any other language and is the **fallback**: a missing translation shows Ukrainian, never
a bare key. A key missing everywhere logs `[i18n] немає ключа: …` in development.

- `src/lib/i18n.ts` — `t()`, `plural()`, `intlLocale()`, `localizedMap()`. `t()` is
  deliberately **not** a hook: `utils/exportManager.ts` and the Leaflet popups call it too.
- The chosen language lives in the **`veles_locale` cookie**, not just localStorage, because
  the *server* has to know it: `app/layout.tsx` reads it with `cookies()` and passes
  `initialLocale` to the provider, so the SSR markup already arrives in the right language and
  `<html lang>` is correct. Without that, SSR always rendered Ukrainian and the client swapped
  the language after hydration — a visible flash of the wrong language on **every page load**
  (it looked like constant blinking under dev Fast Refresh, which reloads often).
  `I18nProvider` seeds the module-level locale synchronously in its render body, before the
  children render, because `t()` reads the module and not the context. On the server that
  variable is process-global; fine for a handful of dispatchers, but it would need
  `AsyncLocalStorage` if this ever served many users with different languages at once.
- `src/context/I18nContext.tsx` — priority: cookie → legacy `localStorage` (migrated on read)
  → `detectLocale()` over `navigator.languages` → **`en`**. Note the two different fallbacks:
  `FALLBACK_LOCALE = 'en'` is what a visitor whose language we don't support sees, while
  `DEFAULT_LOCALE = 'uk'` is the source language a *missing key* falls back to — do not
  collapse them into one constant. Autodetection deliberately does **not** persist a language
  the user never chose; the inline bootstrap script does write the detected one to the cookie,
  so the *next* load is server-rendered correctly and the first-visit flash happens at most
  once per browser. That script duplicates the same priority order — change one, change the
  other. The provider also **remounts the subtree on change** via
  `<Fragment key={locale}>`. That is what makes non-subscribed call sites (module-level
  helpers, chart formatters) follow the language. Switching resets page-local state; it is a
  rare action, so that is the trade.
- `components/LanguageSwitcher.tsx` — `compact` in the topbar and on /login, `segmented` in
  the sidebar. Language codes, **not** flag emoji: Windows has no flag glyphs and renders 🇺🇦
  as "UA", which turned the button into "UA UA".
- `lib/format.ts` caches one `Intl.NumberFormat` per locale — building them at module level
  would freeze the formatter on whichever language was active at import time.
- `utils/exportManager.ts` infers column types from the **rendered** header text, so its
  `KEYWORDS` lists carry the words in all four languages; a Ukrainian-only match silently
  dropped currency formatting once the UI was translated.

The rule that bites: **never call `t()` at module level.** Constant arrays (nav, table
columns, presets) store the *key*, and `t()` goes at the render site — `{t(item.label)}`. For
`Record<K, string>` label maps use `localizedMap({…})`, which translates on read. Forgetting
the render-site `t()` is the one failure this setup makes visible the hard way: the key itself
appears on screen. To check a page, paste in the browser console:

```js
[...new Set((document.body.innerText.match(/\b[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]{2,}\b/g) || []))]
```

Tooling under `frontend/scripts/i18n/` (TypeScript-AST based, so it knows module scope from
function scope):

```
npm run i18n           # coverage + text that still has no key
npm run i18n:check     # same, exit 1 on gaps (CI)
npm run i18n:wrap      # codemod: wrap new Ukrainian text in t() — an intermediate state
npm run i18n:keyize    # assign keys from a TSV (uk-text ⇥ key), fill uk.json
npm run i18n:merge     # apply scripts/i18n/translations/*.tsv (key ⇥ en ⇥ pl ⇥ de)
npm run i18n:prune     # drop keys no longer used in the code
npm run i18n:rename -- old.key new.key
```

Deliberately **not** translated: vendor data arriving from the backend (vehicle names, OKKO
transaction descriptions), code comments, and `shared/config/ruptelaApiDocs.ts` + `RuptelaApiDocs.tsx` —
the Ruptela integration reference for developers, listed in `EXCLUDE`. Strings that are type
discriminators or matching heuristics are exempted per-file with `i18n-ignore-props:` /
`i18n-ignore-raw:` pragmas.

The `i18n-translator` agent (`.claude/agents/`) runs this loop after UI changes.

### Design system — "Aurora Glass"

Tokens live in `src/app/globals.css` and are surfaced to Tailwind in `tailwind.config.ts`.
Component classes: `.glass` `.glass-panel` `.glass-inset` `.glass-float` `.btn` (+`-primary`
`-ghost` `-warn` `-icon`) `.badge` (+ variants) `.field` `.data-table` `.micro-label` `.stat`
`.segmented` `.skeleton` `.rise`.

Rules that matter:
- **Never** use raw palette classes (`slate-*`, `emerald-*`, `#hex`) in components — they
  break the light theme. That's what produced the old 100-line `!important` override block.
- At most **one** `backdrop-filter` layer in a vertical stack. Nested surfaces inside a glass
  panel use `.glass-inset` (no blur).
- Accent colors are declared as RGB channel triplets (`--accent-rgb`), so Tailwind opacity
  modifiers (`bg-accent/10`, `text-warn`) work. Emerald = product accent; amber (`warn`) is
  reserved for Ruptela/telematics; red = destructive/negative only.
- Theme is `useTheme()` from `src/context/ThemeContext.tsx`, single storage key `veles_theme`
  holding a **preference**: `light | dark | system`, defaulting to `system`. The context
  exposes `preference` (what the switcher highlights) and `theme` (the *resolved* light/dark
  that maps and charts need). Do not add a second toggle with its own key — there used to be
  three, which disagreed with each other. UI: `ThemeSwitcher` (three icons, sidebar),
  `ThemeToggleButton` (one cycling icon, topbars), plus three ⌘K commands.
  **Anti-flash rules, both halves required:** the inline script in `layout.tsx` resolves the
  same preference before first paint, and the provider syncs React state in a *layout*
  effect. Using `useEffect` there is what made the theme flash — the class was already right,
  but every component reading `theme` (Leaflet tiles, chart palette, the toggle icon)
  painted once with the default first.
- Charts read colors from CSS variables at render time so they follow the theme.
- The desktop sidebar collapses to a 72 px icon rail (`veles_sidebar_collapsed`), animated
  with `transition-[width,padding]`. Its width is an **inline style**, not `w-[248px]`:
  the JIT-generated arbitrary-value rule went missing across dev hot-rebuilds and left the
  rail stuck wide. The stored state is read in a layout effect, and the transition class is
  withheld until then so the rail does not visibly fold on every page load.

`.claude/skills/ui-design` and `.claude/skills/fullstack` hold the full conventions.

`utils/exportManager.ts` exports Excel (exceljs) and PDF (jspdf + autotable) by **scraping a
rendered `<table>` from the DOM**, inferring column types from cell text and dropping
action/status columns by matching Ukrainian header labels. Table markup changes can silently
break exports.

## Credentials

All vendor keys and the dashboard admin password live in `backend/.env` (gitignored via the
root `.gitignore`; `backend/.env.example` documents the expected variables). Every service
reads them through `ConfigService` with **no secret fallbacks** — a missing key logs a
warning and disables that vendor. Never put a literal key, password, or auth header in
source code, docs, or comments.

## Vendor documentation

`OKKO-Api-Documentation/index.html` (Swagger export), `Shell-Api-Documentation/` (quick-start
PDFs + Postman collection + test PayerNumbers), `Ruptela - Api/` (RnT GraphQL reference PDF —
its page numbers are cited in comments next to the trip mutations).
