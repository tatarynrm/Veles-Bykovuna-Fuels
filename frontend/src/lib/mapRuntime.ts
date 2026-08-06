/**
 * Міст між налаштуваннями з `mapPrefs` і живим екземпляром Leaflet.
 *
 * Карти в проєкті імперативні (L.map у ref), тож і застосування налаштувань
 * імперативне: одна функція `applyMapPrefs` доводить будь-яку карту до стану,
 * описаного в налаштуваннях, скільки б разів її не викликали. Це дає змогу
 * тримати обидві карти — «Мій автопарк» і «Реальний час» — на одному коді й
 * не дублювати логіку контролів.
 *
 * Плагінів немає навмисно: повноекранний режим, «де я» та зчитувач координат
 * написані на L.Control, а не підтягнуті з CDN (сторонні скрипти сюди не
 * тягнемо, та й офлайн-збірка їх би не побачила).
 */

import L from 'leaflet';
import { t } from './i18n';
import {
  LABELS_OVERLAY,
  resolveBasemap,
  showLabels,
  tileFilter,
  type MapPrefs,
} from './mapPrefs';

export interface MapHandles {
  map: L.Map;
  base: L.TileLayer | null;
  labels: L.TileLayer | null;
  zoom: L.Control.Zoom | null;
  scaleMetric: L.Control.Scale | null;
  scaleImperial: L.Control.Scale | null;
  attribution: L.Control.Attribution | null;
  fullscreen: L.Control | null;
  locate: L.Control | null;
  coordinates: L.Control | null;
  locationMarker: L.CircleMarker | null;
  locationAccuracy: L.Circle | null;
  /** Власна реалізація worldCopyJump — оригінальна прив'язується лише при створенні карти. */
  worldCopyHandler: (() => void) | null;
  /** id підкладки, яку зараз намальовано, — щоб не перестворювати шар дарма. */
  basemapId: string | null;
}

export function createHandles(map: L.Map): MapHandles {
  return {
    map,
    base: null,
    labels: null,
    zoom: null,
    scaleMetric: null,
    scaleImperial: null,
    attribution: null,
    fullscreen: null,
    locate: null,
    coordinates: null,
    locationMarker: null,
    locationAccuracy: null,
    worldCopyHandler: null,
    basemapId: null,
  };
}

/* ── власні контроли ────────────────────────────────────────────────────── */

const ICON = {
  expand:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  compress:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
  locate:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg>',
};

/**
 * Кнопки живуть у нижньому правому куті разом із зумом: верхній правий зайняла
 * панель налаштувань, а верхній лівий — легенда статусів.
 */
function buttonControl(
  html: string,
  title: string,
  onClick: (button: HTMLAnchorElement) => void,
): L.Control {
  const Ctl = L.Control.extend({
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const button = L.DomUtil.create('a', 'veles-map-btn', wrap) as HTMLAnchorElement;
      button.href = '#';
      button.innerHTML = html;
      button.title = title;
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', title);
      // Без цього клік по кнопці «протікає» на карту й дає зайвий зум.
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(button, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        onClick(button);
      });
      (this as any)._button = button;
      return wrap;
    },
  });
  return new Ctl({ position: 'bottomright' });
}

/**
 * Повний екран розгортає обгортку карти, а не сам контейнер Leaflet: разом із
 * картою мають лишитись легенда й кнопка налаштувань, інакше в повному екрані
 * користувач втрачає керування.
 */
function fullscreenTarget(map: L.Map): HTMLElement {
  const container = map.getContainer();
  return (container.closest('[data-map-shell]') as HTMLElement | null) ?? container;
}

function createFullscreenControl(map: L.Map): L.Control {
  const control = buttonControl(ICON.expand, t('map.fullscreen'), () => {
    const target = fullscreenTarget(map);
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void target.requestFullscreen?.().catch(() => {
        /* браузер міг відмовити — мовчки лишаємось у звичайному режимі */
      });
    }
  });

  // Leaflet рахує розмір контейнера один раз; після зміни режиму його треба
  // перерахувати, інакше половина карти лишається сірою.
  const onChange = () => {
    const active = document.fullscreenElement === fullscreenTarget(map);
    const button = (control as any)._button as HTMLElement | undefined;
    if (button) button.innerHTML = active ? ICON.compress : ICON.expand;
    setTimeout(() => map.invalidateSize(), 120);
  };
  document.addEventListener('fullscreenchange', onChange);
  (control as any)._velesCleanup = () =>
    document.removeEventListener('fullscreenchange', onChange);

  return control;
}

function createLocateControl(map: L.Map): L.Control {
  return buttonControl(ICON.locate, t('map.myLocation'), () => {
    map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true });
  });
}

function createCoordinatesControl(map: L.Map): L.Control {
  const Ctl = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create('div', 'veles-map-coords leaflet-control');
      box.innerHTML = '—';
      const write = (latlng: L.LatLng | null) => {
        box.innerHTML = latlng
          ? `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`
          : '—';
      };
      map.on('mousemove', (e: L.LeafletMouseEvent) => write(e.latlng));
      map.on('mouseout', () => write(null));
      return box;
    },
  });
  return new Ctl({ position: 'bottomleft' });
}

/* ── застосування налаштувань ───────────────────────────────────────────── */

function syncBasemap(handles: MapHandles, prefs: MapPrefs, theme: 'light' | 'dark') {
  const { map } = handles;
  const def = resolveBasemap(prefs, theme);

  if (handles.basemapId !== def.id) {
    handles.base?.remove();
    handles.base = L.tileLayer(def.url, {
      attribution: def.attribution,
      maxZoom: def.maxZoom,
      subdomains: def.subdomains ?? 'abc',
      // Плитку тримаємо найнижчим шаром, щоб треки й маркери лишались зверху
      // навіть після перемикання підкладки.
      zIndex: 1,
    }).addTo(map);
    handles.basemapId = def.id;

    // Різні провайдери мають різну стелю масштабу. Без цього на OpenTopoMap
    // (17) карта на 18-му зумі ставала порожньою.
    map.setMaxZoom(def.maxZoom);
    if (map.getZoom() > def.maxZoom) map.setZoom(def.maxZoom);
  }
  handles.base?.setOpacity(prefs.opacity);

  const wantLabels = showLabels(prefs, def);
  if (wantLabels && !handles.labels) {
    handles.labels = L.tileLayer(LABELS_OVERLAY.dark, {
      attribution: LABELS_OVERLAY.attribution,
      subdomains: LABELS_OVERLAY.subdomains,
      maxZoom: LABELS_OVERLAY.maxZoom,
      zIndex: 2,
    }).addTo(map);
  } else if (!wantLabels && handles.labels) {
    handles.labels.remove();
    handles.labels = null;
  }

  const pane = map.getPane('tilePane');
  if (pane) pane.style.filter = tileFilter(prefs);
}

function syncControls(handles: MapHandles, prefs: MapPrefs) {
  const { map } = handles;

  if (prefs.zoomControl && !handles.zoom) {
    handles.zoom = L.control.zoom({ position: 'bottomright' }).addTo(map);
  } else if (!prefs.zoomControl && handles.zoom) {
    handles.zoom.remove();
    handles.zoom = null;
  }

  const wantMetric = prefs.scale === 'metric' || prefs.scale === 'both';
  const wantImperial = prefs.scale === 'imperial' || prefs.scale === 'both';

  if (wantMetric && !handles.scaleMetric) {
    handles.scaleMetric = L.control
      .scale({ position: 'bottomleft', metric: true, imperial: false })
      .addTo(map);
  } else if (!wantMetric && handles.scaleMetric) {
    handles.scaleMetric.remove();
    handles.scaleMetric = null;
  }

  if (wantImperial && !handles.scaleImperial) {
    handles.scaleImperial = L.control
      .scale({ position: 'bottomleft', metric: false, imperial: true })
      .addTo(map);
  } else if (!wantImperial && handles.scaleImperial) {
    handles.scaleImperial.remove();
    handles.scaleImperial = null;
  }

  /*
    Карту ОБОВ'ЯЗКОВО створювати з `attributionControl: true` — тоді
    TileLayer.onAdd сам реєструє підпис провайдера. Ховаємо/показуємо не
    опцією (вона діє лише в конструкторі), а самим контролом; список підписів
    він при цьому не втрачає, бо addAttribution пише в нього і без карти.
  */
  handles.attribution = map.attributionControl ?? null;
  const attached = Boolean((handles.attribution as any)?._map);
  if (prefs.attribution && handles.attribution && !attached) {
    handles.attribution.addTo(map);
  } else if (!prefs.attribution && handles.attribution && attached) {
    handles.attribution.remove();
  }

  if (prefs.fullscreenControl && !handles.fullscreen) {
    handles.fullscreen = createFullscreenControl(map).addTo(map);
  } else if (!prefs.fullscreenControl && handles.fullscreen) {
    (handles.fullscreen as any)._velesCleanup?.();
    handles.fullscreen.remove();
    handles.fullscreen = null;
  }

  if (prefs.locateControl && !handles.locate) {
    handles.locate = createLocateControl(map).addTo(map);
  } else if (!prefs.locateControl && handles.locate) {
    handles.locate.remove();
    handles.locate = null;
    handles.locationMarker?.remove();
    handles.locationAccuracy?.remove();
    handles.locationMarker = null;
    handles.locationAccuracy = null;
  }

  if (prefs.coordinates && !handles.coordinates) {
    handles.coordinates = createCoordinatesControl(map).addTo(map);
  } else if (!prefs.coordinates && handles.coordinates) {
    handles.coordinates.remove();
    handles.coordinates = null;
  }
}

function syncInteraction(handles: MapHandles, prefs: MapPrefs) {
  const { map } = handles;
  const toggle = (handler: L.Handler | undefined, on: boolean) => {
    if (!handler) return;
    if (on) handler.enable();
    else handler.disable();
  };

  toggle(map.scrollWheelZoom, prefs.scrollWheelZoom);
  toggle(map.doubleClickZoom, prefs.doubleClickZoom);
  toggle(map.dragging, prefs.dragging);
  toggle(map.keyboard, prefs.keyboard);
  toggle(map.boxZoom, prefs.boxZoom);
  toggle(map.touchZoom, prefs.scrollWheelZoom);

  // inertia і zoomSnap читаються з options під час жесту, тож досить їх записати.
  map.options.inertia = prefs.inertia;
  map.options.zoomSnap = prefs.zoomSnap;
  map.options.zoomDelta = prefs.zoomSnap === 1 ? 1 : prefs.zoomSnap;

  // worldCopyJump Leaflet вішає лише в конструкторі, тому робимо свій обробник.
  if (prefs.worldCopyJump && !handles.worldCopyHandler) {
    const jump = () => {
      const center = map.getCenter();
      const wrapped = map.wrapLatLng(center);
      if (!center.equals(wrapped)) map.setView(wrapped, map.getZoom(), { animate: false });
    };
    handles.worldCopyHandler = jump;
    map.on('moveend', jump);
  } else if (!prefs.worldCopyJump && handles.worldCopyHandler) {
    map.off('moveend', handles.worldCopyHandler);
    handles.worldCopyHandler = null;
  }
}

/** Доводить карту до стану, описаного налаштуваннями. Ідемпотентна. */
export function applyMapPrefs(
  handles: MapHandles,
  prefs: MapPrefs,
  theme: 'light' | 'dark',
): void {
  syncBasemap(handles, prefs, theme);
  syncControls(handles, prefs);
  syncInteraction(handles, prefs);
}

/** Малює місце користувача після `map.locate()`. Викликати з обробника locationfound. */
export function drawUserLocation(handles: MapHandles, e: L.LocationEvent): void {
  const { map } = handles;
  handles.locationMarker?.remove();
  handles.locationAccuracy?.remove();

  handles.locationAccuracy = L.circle(e.latlng, {
    radius: e.accuracy,
    color: '#3B82F6',
    weight: 1,
    fillColor: '#3B82F6',
    fillOpacity: 0.12,
  }).addTo(map);

  handles.locationMarker = L.circleMarker(e.latlng, {
    radius: 6,
    color: '#ffffff',
    weight: 2,
    fillColor: '#3B82F6',
    fillOpacity: 1,
  })
    .bindTooltip(t('map.youAreHere'), { direction: 'top' })
    .addTo(map);
}

/** Знімає все, що додав applyMapPrefs. Викликати перед map.remove(). */
export function disposeHandles(handles: MapHandles): void {
  (handles.fullscreen as any)?._velesCleanup?.();
  if (handles.worldCopyHandler) handles.map.off('moveend', handles.worldCopyHandler);
  handles.worldCopyHandler = null;
}
