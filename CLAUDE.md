# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Fleet-fuel ERP dashboard for ТОВ "Велес Буковина". A NestJS backend proxies three external
vendor APIs (OKKO fuel cards, Shell Mobility B2B cards, Ruptela/fm-track telematics) and
normalizes them into one shape; a Next.js App Router frontend renders the dashboard.
UI text is Ukrainian — keep new user-facing strings in Ukrainian.

Not a git repository. No test suite, no linter config beyond `next lint`.

## Commands

Backend (`backend/`, NestJS, listens on **3001**):
```
npm run start:dev      # watch mode — the normal dev loop
npm run build          # nest build -> dist/
npm run start:prod     # node dist/main
npm run format         # prettier over src/**/*.ts
```

Frontend (`frontend/`, Next.js 14, listens on **3000**):
```
npm run dev
npm run build
npm run lint
```

Both must run for the app to work. The backend host lives in one place —
`src/lib/api.ts` (`NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001`). Do not
reintroduce hardcoded hosts in components.

Note: `next build` and `next dev` share `.next`. Running a build while the dev server is up
corrupts its chunks (`Cannot find module './230.js'`). Stop dev, `rm -rf .next`, then build.

## Architecture

### Backend: vendor adapters + thin aggregating controllers

`src/<vendor>/<vendor>-api.service.ts` are the only places that talk to an external API.
Everything else consumes their normalized TypeScript interfaces.

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

Cross-vendor endpoints (`transactions`, `cards`, `merchants`, `analytics`) take a
`brand=ALL|OKKO|SHELL` query param, fan out to the relevant services, map Shell's PascalCase
fields onto the OKKO snake_case shape, concatenate, then **paginate in memory**
(`{ items, total, page, size, totalPages }`) — the vendors' own paging is not used.

Every vendor call is wrapped in try/catch that logs and **returns an empty array**. A dead
upstream therefore surfaces as zeroed KPIs, never an error response — check backend logs,
not HTTP status, when data looks missing.

`auth/auth.controller.ts` is a stub: credentials come from env (`AUTH_ADMIN_USER` /
`AUTH_ADMIN_PASSWORD`; passwordless demo logins `okko`/`shell`/`demo` only when
`AUTH_DEMO_ENABLED=true`), but the "token" is still a timestamp string and no other
route has a guard.

### Frontend: page-level fetching through a thin lib layer

Every page under `src/app/` is a `'use client'` component. The shared pieces:

- `src/lib/api.ts` — `apiGet` / `apiSend` / `apiList` / `apiObject` / `unwrapList`.
  `apiList` tolerates *both* response shapes: collection endpoints (`/api/cards`,
  `/api/merchants`, `/api/transactions`) return `{items,total,page,size,totalPages}`, while
  `/api/contracts` and the analytics routes return bare arrays. Treating one as the other
  silently renders an empty screen — that bug had blanked the cards page.
- `src/lib/useAuthGuard.ts` — the session gate every page uses.
- `src/lib/format.ts` — `uk-UA` currency/number/date formatters.
- `components/PageShell.tsx` — sidebar + sticky topbar + brand tabs + date picker.
  `components/RuptelaShell.tsx` — the same for the amber telematics section.
  Pages own data; they should not re-implement chrome.

Shared per-page state (`activeBrand`, `DateRange`) is still local `useState` prop-drilled
into the shell.

`/fleet` (1100+ lines) is a standalone 3D truck-diagnostics view with **local mock state
only** — it never calls the backend. `/ruptela/fleet` is the real telematics view.
`/ruptela/live` watches **one** vehicle: it polls `/coordinates` on a dispatcher-chosen
interval (3/5/10/30 s), keeps an incremental client-side buffer keyed by `datetime`, trims it
to the selected window (15 хв–3 год), and draws the track on `RuptelaLiveTrackMap`. When the
chosen window is empty it widens **once** to 24 h and says so, rather than showing a blank
map for a truck that has been parked overnight.
Both `ThreeTruckViewer` (react-three-fiber) and `RuptelaFleetMap` (Leaflet) are loaded via
`next/dynamic` because they touch `window`; keep any new map/3D component the same way.
Anything using `useSearchParams()` needs a `<Suspense>` boundary or the static export fails.

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
- Theme is `useTheme()` from `src/context/ThemeContext.tsx`, single storage key
  `veles_theme`, applied pre-paint by an inline script in `layout.tsx`. Do not add a second
  toggle with its own key — there used to be three, which disagreed with each other.
- Charts read colors from CSS variables at render time so they follow the theme.

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
