---
name: ui-design
description: Product-design system and craft rules for building UI in this repo — glassmorphism surfaces, spacing/type/color scales, motion, dual-theme correctness, and a pre-ship checklist. Use whenever creating or restyling any screen, component, chart, table, modal, or CSS token.
---

# UI Design — Aurora Glass

You are the design authority for this product. Ship interfaces that look like Linear, Vercel,
Arc and Apple's visionOS panels: **calm, dense, minimal, with real depth**. Not neon, not
"cyberpunk dashboard", not a wall of glowing borders.

## 1. The one rule that makes glass look real

Frosted glass is **not** `background: rgba(...)` + `backdrop-filter: blur()`. That reads as
"gray box". Real glass needs four layers, always together:

```css
background: var(--glass-bg);                 /* 1. low-alpha tint */
backdrop-filter: blur(24px) saturate(180%);  /* 2. blur AND saturation boost */
border: 1px solid var(--glass-border);       /* 3. hairline edge */
box-shadow:
  inset 0 1px 0 var(--glass-highlight),      /* 4. top inner light-catch  ← the magic */
  var(--shadow-glass);                       /*    plus an outer soft drop */
```

Layer 4 is what the eye reads as "a pane of glass catching light from above". Without it,
nothing else helps. `saturate()` in layer 2 is what keeps the content behind the glass from
going muddy.

**Glass needs something to refract.** A frosted panel over a flat background is invisible.
The page must have an ambient layer behind it — slow, huge, very low-opacity color blobs
(the "aurora") plus a faint dot grid. Blobs at 6–12% opacity in dark, 4–8% in light.

**Don't stack glass on glass.** Two blurred layers on top of each other turn to soup. Nested
elements inside a glass panel use a *solid or near-solid* inset surface (`--surface-inset`),
never another `backdrop-filter`. Rule: **max one blur layer in any vertical stack** (plus the
sidebar/topbar chrome, which sits over page background, not over another panel).

## 2. Scales — pick from these, never invent values

**Radius** — `10` controls · `14` inputs/badges/small cards · `20` cards · `28` panels ·
`9999` pills. Nested radius = parent radius − padding, so corners stay concentric.

**Space** — 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48. Panel padding 20–24. Grid gap 16–20.
Related items 8, unrelated groups 24+.

**Type** — one family (Inter / system UI), five roles only:
| role | size | weight | tracking |
|---|---|---|---|
| page title | 22–28px | 600 | −0.02em |
| section title | 15–16px | 600 | −0.01em |
| body | 13px | 450–500 | 0 |
| meta / secondary | 11–12px | 500 | 0 |
| micro-label (uppercase) | 10px | 600 | 0.08em |

Numbers use `font-variant-numeric: tabular-nums`. Never `font-black`/900 — it reads cheap at
small sizes. Weight is not how you create hierarchy; **size and color are**.

**Elevation** — flat page → glass panel → floating (dropdown/modal). Three levels, no more.
Elevation comes from shadow softness and border brightness, not from stronger tint.

## 3. Color

- **One accent.** Emerald is the product accent — used for primary action, active nav,
  positive delta, and nothing else. Amber is reserved *by domain* for telematics/Ruptela.
  Red only for destructive/negative values.
- Neutrals carry the UI. If a screen looks boring in grayscale, adding color won't fix it.
- Semantics through tokens (`--text-primary`, `--surface-inset`, `--border-subtle`), never
  raw palette classes like `slate-800` in component code. Raw palette breaks the light theme —
  that is exactly how the previous version ended up with 100 lines of `!important` overrides.
- Status color always pairs with a non-color cue (icon, dot, label). Never color alone.

## 4. Motion

Duration 150ms (hover/state) · 220ms (enter) · 300ms (layout). Easing
`cubic-bezier(0.22, 1, 0.36, 1)` for enter, `cubic-bezier(0.4, 0, 0.2, 1)` for state.
Entering content rises 6–10px while fading. Stagger lists by 30–40ms, cap the stagger at
~8 items. Hover lift is `translateY(-2px)` max. Anything that pulses forever (`animate-ping`,
`animate-pulse`) must mean "live data", never decoration — a dashboard where everything
throbs reads as broken.

Always honor `prefers-reduced-motion: reduce` by collapsing animation to opacity only.

## 5. Density and restraint

This is a data product. Favor density, but earn it with alignment:
- Right-align and tabular-align every numeric column; left-align text; never center either.
- One primary action per view. Everything else is ghost/secondary.
- Badges: one shape, one size, tinted background + matching text + hairline. Not six variants.
- Kill decoration that carries no data: emoji in navigation, gradient borders, drop shadows on
  text, duplicate icons, "shadow-2xl" on inline elements.
- Empty states get an icon, one sentence explaining *why* it's empty, and (if applicable) the
  action that fills it.
- Skeletons must match the real layout's boxes, not generic gray bars.

## 6. Dual theme is not optional

Every surface must be authored for both themes **through tokens**, then eyeballed in both.
In light mode: glass tint goes *up* (toward opaque white), borders become darker not lighter,
shadows get softer and cooler, the accent darkens one step for AA contrast on white.

Verify contrast: body text ≥ 4.5:1, micro-labels ≥ 4.5:1 (they are small — do not let them
drift to 3:1), non-text UI boundaries ≥ 3:1.

## 7. Accessibility floor

- Visible `:focus-visible` ring on every interactive element (2px accent + 2px offset).
  Never `outline: none` without a replacement.
- Hit targets ≥ 36px on desktop chrome, ≥ 44px on touch.
- Icon-only buttons need `title` **and** `aria-label`.
- Modals: overlay click closes, Escape closes, focus is trapped, body scroll locks.
- Dropdowns close on outside click and on Escape.

## 8. Pre-ship checklist

Run this before declaring any screen done:

1. Toggle the theme — is anything invisible, muddy, or still dark-on-dark?
2. Resize to 375px — does anything overflow horizontally? Do tables scroll in their own
   container rather than pushing the page?
3. Tab through — is focus always visible and in DOM order?
4. Empty data — does every list/chart/table have a real empty state?
5. Loading — skeleton matches final layout; no layout shift on data arrival.
6. Squint at it — does one thing dominate? If everything is equally loud, hierarchy failed.
7. Count blur layers in one vertical stack — more than one? Fix it.
8. Grep the diff for raw palette classes (`slate-`, `#hex`) in component code — replace with
   tokens.

## 9. Token contract for this repo

Defined in `frontend/src/app/globals.css`, exposed to Tailwind in `tailwind.config.ts`.

Surfaces `--bg-page` `--surface` `--surface-inset` `--surface-hover` `--glass-bg`
`--glass-border` `--glass-highlight` ·
Text `--text-primary` `--text-secondary` `--text-muted` ·
Borders `--border-subtle` `--border-strong` `--border-accent` ·
Accent `--accent` `--accent-hover` `--accent-soft` `--accent-contrast`, plus `--warn`
(telematics/amber) and `--danger` ·
Shadow `--shadow-sm` `--shadow-md` `--shadow-float` `--shadow-glass`.

Component classes: `.glass` `.glass-panel` `.glass-inset` `.btn` `.btn-primary` `.btn-ghost`
`.btn-icon` `.badge` (+ `-success` `-warn` `-danger` `-neutral` `-accent`) `.field`
`.data-table` `.micro-label` `.stat` `.rise` `.rise-stagger`.

Use these. Adding a new one is fine; hardcoding a color in a component is not.
