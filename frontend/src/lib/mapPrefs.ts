/**
 * Налаштування карт — один спільний стан для всіх Leaflet-екранів.
 *
 * Вибір підкладки й поведінки карти зберігається у localStorage і переживає
 * перезавантаження. Стан навмисно живе поза React: карту малює імперативний
 * Leaflet, а не дерево компонентів, тому підписка на зміни (`onMapPrefsChange`)
 * зручніша за проброс пропсів крізь дві різні карти.
 *
 * Жодного плагіна: у проєкті чистий leaflet 1.9, а зовнішні скрипти сюди не
 * тягнемо. Усе нижче — або рідні можливості Leaflet, або тонкий шар CSS поверх
 * плитки.
 */

import { t } from './i18n';

export const MAP_PREFS_KEY = 'veles_map_v1';

/* ── каталог підкладок ──────────────────────────────────────────────────── */

export interface BasemapDef {
  id: string;
  /** Ключ i18n, а не готовий текст: назви читаються в момент рендеру. */
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
  /** Темна плитка — над нею світлі підписи й треки читаються інакше. */
  dark?: boolean;
  /** Знімки з супутника: за замовчуванням вмикаємо накладку з підписами. */
  imagery?: boolean;
}

const CARTO_ATTR = '&copy; CARTO &copy; OpenStreetMap contributors';
const OSM_ATTR = '&copy; OpenStreetMap contributors';
const ESRI_ATTR = 'Tiles &copy; Esri';

/**
 * `auto` — не окрема плитка, а вказівка «бери підкладку за темою інтерфейсу».
 * Саме така поведінка була до появи цього вибору, тож вона й лишається типовою.
 */
export const AUTO_BASEMAP = 'auto';

export const BASEMAPS: BasemapDef[] = [
  {
    id: 'carto-dark',
    label: 'map.basemapCartoDark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR,
    maxZoom: 20,
    subdomains: 'abcd',
    dark: true,
  },
  {
    id: 'carto-light',
    label: 'map.basemapCartoLight',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR,
    maxZoom: 20,
    subdomains: 'abcd',
  },
  {
    id: 'carto-voyager',
    label: 'map.basemapVoyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR,
    maxZoom: 20,
    subdomains: 'abcd',
  },
  {
    id: 'osm',
    label: 'map.basemapOsm',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxZoom: 19,
  },
  {
    id: 'osm-hot',
    label: 'map.basemapOsmHot',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTR}, Humanitarian OSM Team`,
    maxZoom: 20,
    subdomains: 'ab',
  },
  {
    id: 'topo',
    label: 'map.basemapTopo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTR}, SRTM | OpenTopoMap (CC-BY-SA)`,
    maxZoom: 17,
    subdomains: 'abc',
  },
  {
    id: 'esri-imagery',
    label: 'map.basemapSatellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: `${ESRI_ATTR}, Maxar, Earthstar Geographics`,
    maxZoom: 19,
    dark: true,
    imagery: true,
  },
  {
    id: 'esri-streets',
    label: 'map.basemapEsriStreets',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTR,
    maxZoom: 19,
  },
  {
    id: 'esri-dark-gray',
    label: 'map.basemapEsriDarkGray',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTR,
    maxZoom: 16,
    dark: true,
  },
];

/** Підписи окремим шаром — щоб назви міст читалися поверх супутника. */
export const LABELS_OVERLAY = {
  dark: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
  attribution: CARTO_ATTR,
  subdomains: 'abcd',
  maxZoom: 20,
};

export const basemapById = (id: string): BasemapDef | undefined =>
  BASEMAPS.find((b) => b.id === id);

/** Підкладка під поточну тему, коли обрано «автоматично». */
export const autoBasemap = (theme: 'light' | 'dark'): BasemapDef =>
  basemapById(theme === 'light' ? 'carto-light' : 'carto-dark')!;

/** Підкладка, яку насправді треба намалювати. */
export function resolveBasemap(prefs: MapPrefs, theme: 'light' | 'dark'): BasemapDef {
  if (prefs.basemap === AUTO_BASEMAP) return autoBasemap(theme);
  return basemapById(prefs.basemap) ?? autoBasemap(theme);
}

export const basemapLabel = (id: string): string =>
  id === AUTO_BASEMAP ? t('map.basemapAuto') : t(basemapById(id)?.label ?? 'map.basemapAuto');

/* ── налаштування ───────────────────────────────────────────────────────── */

export type ScaleMode = 'off' | 'metric' | 'imperial' | 'both';

export interface MapPrefs {
  /** id з BASEMAPS або AUTO_BASEMAP. */
  basemap: string;
  /** Накладка з підписами. `auto` — лише над супутником, де без неї не обійтись. */
  labels: 'auto' | 'on' | 'off';

  /* вигляд плитки */
  opacity: number; // 0.2 … 1
  grayscale: boolean;
  brightness: number; // 0.5 … 1.5
  contrast: number; // 0.5 … 1.5

  /* елементи керування Leaflet */
  zoomControl: boolean;
  scale: ScaleMode;
  attribution: boolean;
  fullscreenControl: boolean;
  locateControl: boolean;
  coordinates: boolean;

  /* взаємодія */
  scrollWheelZoom: boolean;
  doubleClickZoom: boolean;
  dragging: boolean;
  inertia: boolean;
  keyboard: boolean;
  boxZoom: boolean;
  worldCopyJump: boolean;
  /** 1 — цілі рівні, 0.5/0.25 — плавніше масштабування. */
  zoomSnap: number;
}

export const DEFAULT_MAP_PREFS: MapPrefs = {
  basemap: AUTO_BASEMAP,
  labels: 'auto',

  opacity: 1,
  grayscale: false,
  brightness: 1,
  contrast: 1,

  zoomControl: true,
  scale: 'metric',
  attribution: true,
  fullscreenControl: true,
  locateControl: true,
  coordinates: false,

  scrollWheelZoom: true,
  doubleClickZoom: true,
  dragging: true,
  inertia: true,
  keyboard: true,
  boxZoom: true,
  worldCopyJump: false,
  zoomSnap: 1,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Читання зі сховища завжди проходить крізь нормалізацію: у localStorage може
 * лежати запис від старішої версії або відредагований руками. Невідоме поле
 * замінюється типовим значенням, а не валить карту.
 */
export function normalizeMapPrefs(raw: unknown): MapPrefs {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<MapPrefs>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

  const basemap =
    typeof input.basemap === 'string' &&
    (input.basemap === AUTO_BASEMAP || basemapById(input.basemap))
      ? input.basemap
      : DEFAULT_MAP_PREFS.basemap;

  const labels =
    input.labels === 'on' || input.labels === 'off' || input.labels === 'auto'
      ? input.labels
      : DEFAULT_MAP_PREFS.labels;

  const scale: ScaleMode =
    input.scale === 'off' ||
    input.scale === 'metric' ||
    input.scale === 'imperial' ||
    input.scale === 'both'
      ? input.scale
      : DEFAULT_MAP_PREFS.scale;

  const zoomSnap = [1, 0.5, 0.25].includes(Number(input.zoomSnap))
    ? Number(input.zoomSnap)
    : DEFAULT_MAP_PREFS.zoomSnap;

  return {
    basemap,
    labels,
    opacity: clamp(Number(input.opacity ?? DEFAULT_MAP_PREFS.opacity) || 1, 0.2, 1),
    grayscale: bool(input.grayscale, DEFAULT_MAP_PREFS.grayscale),
    brightness: clamp(Number(input.brightness ?? 1) || 1, 0.5, 1.5),
    contrast: clamp(Number(input.contrast ?? 1) || 1, 0.5, 1.5),

    zoomControl: bool(input.zoomControl, DEFAULT_MAP_PREFS.zoomControl),
    scale,
    attribution: bool(input.attribution, DEFAULT_MAP_PREFS.attribution),
    fullscreenControl: bool(input.fullscreenControl, DEFAULT_MAP_PREFS.fullscreenControl),
    locateControl: bool(input.locateControl, DEFAULT_MAP_PREFS.locateControl),
    coordinates: bool(input.coordinates, DEFAULT_MAP_PREFS.coordinates),

    scrollWheelZoom: bool(input.scrollWheelZoom, DEFAULT_MAP_PREFS.scrollWheelZoom),
    doubleClickZoom: bool(input.doubleClickZoom, DEFAULT_MAP_PREFS.doubleClickZoom),
    dragging: bool(input.dragging, DEFAULT_MAP_PREFS.dragging),
    inertia: bool(input.inertia, DEFAULT_MAP_PREFS.inertia),
    keyboard: bool(input.keyboard, DEFAULT_MAP_PREFS.keyboard),
    boxZoom: bool(input.boxZoom, DEFAULT_MAP_PREFS.boxZoom),
    worldCopyJump: bool(input.worldCopyJump, DEFAULT_MAP_PREFS.worldCopyJump),
    zoomSnap,
  };
}

/* ── стан на рівні модуля ───────────────────────────────────────────────── */

let current: MapPrefs = DEFAULT_MAP_PREFS;
let loaded = false;
const listeners = new Set<(prefs: MapPrefs) => void>();

/**
 * Читає збережені налаштування один раз за життя вкладки. Далі джерело правди —
 * `current`: сторінка може перемонтуватись (перехід між екранами розмонтовує
 * карту), і повторне читання сховища на кожному монтуванні лише додавало б
 * ризик розсинхрону з тим, що вже намальовано.
 */
export function getMapPrefs(): MapPrefs {
  if (!loaded && typeof window !== 'undefined') {
    loaded = true;
    try {
      const raw = window.localStorage.getItem(MAP_PREFS_KEY);
      current = normalizeMapPrefs(raw ? JSON.parse(raw) : null);
    } catch {
      /* приватний режим або зіпсований JSON — лишаємо типові */
      current = DEFAULT_MAP_PREFS;
    }
  }
  return current;
}

export function setMapPrefs(patch: Partial<MapPrefs>): MapPrefs {
  current = normalizeMapPrefs({ ...getMapPrefs(), ...patch });
  try {
    window.localStorage.setItem(MAP_PREFS_KEY, JSON.stringify(current));
  } catch {
    /* без збереження — налаштування діятимуть до перезавантаження */
  }
  listeners.forEach((fn) => fn(current));
  return current;
}

export function resetMapPrefs(): MapPrefs {
  return setMapPrefs(DEFAULT_MAP_PREFS);
}

export function onMapPrefsChange(fn: (prefs: MapPrefs) => void): () => void {
  listeners.add(fn);
  ensureCrossTabSync();
  return () => listeners.delete(fn);
}

/**
 * Друга вкладка з тією ж картою має показувати те саме. Подія `storage`
 * приходить лише в ІНШІ вкладки, тож зациклення тут неможливе: та, що
 * записала, оновлює себе через setMapPrefs.
 */
let crossTabBound = false;
function ensureCrossTabSync(): void {
  if (crossTabBound || typeof window === 'undefined') return;
  crossTabBound = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== MAP_PREFS_KEY) return;
    try {
      current = normalizeMapPrefs(event.newValue ? JSON.parse(event.newValue) : null);
    } catch {
      return;
    }
    loaded = true;
    listeners.forEach((fn) => fn(current));
  });
}

/** CSS-фільтр для плитки: сірий режим, яскравість і контраст одним рядком. */
export function tileFilter(prefs: MapPrefs): string {
  const parts: string[] = [];
  if (prefs.grayscale) parts.push('grayscale(1)');
  if (prefs.brightness !== 1) parts.push(`brightness(${prefs.brightness})`);
  if (prefs.contrast !== 1) parts.push(`contrast(${prefs.contrast})`);
  return parts.join(' ');
}

/** Чи малювати накладку з підписами для цієї підкладки. */
export function showLabels(prefs: MapPrefs, basemap: BasemapDef): boolean {
  if (prefs.labels === 'on') return true;
  if (prefs.labels === 'off') return false;
  return Boolean(basemap.imagery);
}
