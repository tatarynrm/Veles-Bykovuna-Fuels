'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Layers, RotateCcw, X } from 'lucide-react';
import { t } from '@/lib/i18n';
import {
  AUTO_BASEMAP,
  BASEMAPS,
  DEFAULT_MAP_PREFS,
  autoBasemap,
  getMapPrefs,
  onMapPrefsChange,
  resetMapPrefs,
  setMapPrefs,
  type BasemapDef,
  type MapPrefs,
  type ScaleMode,
} from '@/lib/mapPrefs';
import { useTheme } from '@/context/ThemeContext';

/**
 * Панель налаштувань карти — спільна для «Мого автопарку» й «Реального часу».
 *
 * Стан не пробрасується пропсами: джерело правди — модуль `mapPrefs`, а тут
 * лише його дзеркало. Завдяки цьому дві карти на різних сторінках показують
 * однакові налаштування, і жодна з них не мусить нічого знати про іншу.
 *
 * Панель свідомо лежить усередині обгортки карти (`data-map-shell`), а не в
 * порталі: у повноекранному режимі показується саме ця обгортка, і панель у
 * <body> була б там недосяжною.
 */

/** Одна плитка над Україною — досить, щоб побачити стиль підкладки. */
const PREVIEW = { z: 5, x: 18, y: 10 };

function previewUrl(def: BasemapDef): string {
  return def.url
    .replace('{s}', (def.subdomains ?? 'abc')[0])
    .replace('{z}', String(PREVIEW.z))
    .replace('{x}', String(PREVIEW.x))
    .replace('{y}', String(PREVIEW.y))
    .replace('{r}', '');
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-2xs text-txt-secondary">{label}</span>
        {hint && <span className="block text-micro text-txt-muted">{hint}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </label>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  /*
    Повзунок — звичайний елемент потоку у flex-рядку, а не `absolute`.
    З `absolute` без `left` відлік ішов від статичної позиції, а кнопка центрує
    свій вміст — тому у вимкненому стані повзунок стояв майже біля правого краю.

    Рамка є в обох станах (у ввімкненому — прозора): якби вона з'являлась лише
    у вимкненому, внутрішня коробка зсувалась би на 1px і повзунок сіпався б
    при кожному перемиканні.
  */
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200 ${
        checked ? 'border-transparent bg-accent' : 'border-bdr-subtle bg-surface-inset'
      }`}
    >
      <span
        aria-hidden
        className={`h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${
          // Хід = ширина доріжки − рамки − відступи − повзунок = 36−2−4−16 = 14px,
          // тобто рівно translate-x-3.5 — звичайний крок шкали, без довільного
          // значення (їхні правила JIT тут уже зникали після перезбірок).
          checked ? 'translate-x-3.5 bg-white' : 'translate-x-0 bg-txt-muted'
        }`}
      />
    </button>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="segmented p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`segmented-item px-2 py-1 text-micro ${
            value === option.value ? 'segmented-item-active' : ''
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="veles-range w-28"
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-bdr-subtle pt-2.5 first:border-0 first:pt-0">
      <p className="micro-label mb-1">{title}</p>
      {children}
    </div>
  );
}

export default function MapSettingsPanel() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<MapPrefs>(DEFAULT_MAP_PREFS);
  const rootRef = useRef<HTMLDivElement>(null);

  // Читаємо збережене вже на клієнті: на сервері localStorage немає, і початковий
  // рендер має збігтися з розміткою сервера.
  useEffect(() => {
    setPrefs(getMapPrefs());
    return onMapPrefsChange(setPrefs);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const patch = (next: Partial<MapPrefs>) => setPrefs(setMapPrefs(next));

  const activeLabel =
    prefs.basemap === AUTO_BASEMAP
      ? t('map.basemapAuto')
      : t(BASEMAPS.find((b) => b.id === prefs.basemap)?.label ?? 'map.basemapAuto');

  const autoDef = autoBasemap(theme === 'light' ? 'light' : 'dark');

  /*
    Обгортка розтягнута на всю висоту карти (top-3 … bottom-3) і є flex-колонкою:
    завдяки цьому панель ЗМЕНШУЄТЬСЯ до вільного місця й прокручується всередині,
    а не обрізається рамкою карти (у неї overflow-hidden заради заокруглених
    кутів). `pointer-events-none` на обгортці лишає карту перетягуваною —
    інакше невидима колонка з'їдала б увесь правий край.
  */
  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute bottom-3 right-3 top-3 z-[500] flex flex-col items-end gap-2"
      data-tour="map-settings"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('map.mapSettings')}
        title={`${t('map.mapSettings')} · ${activeLabel}`}
        className="glass-float pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-field px-2.5 py-2 text-2xs font-medium text-txt-secondary transition-colors hover:text-txt-primary"
      >
        <Layers className="h-3.5 w-3.5 text-accent" />
        <span className="hidden max-w-[120px] truncate sm:inline">{activeLabel}</span>
      </button>

      {open && (
        <div
          className="glass-float animate-pop pointer-events-auto min-h-0 w-[290px] overflow-y-auto overscroll-contain rounded-card p-3"
          role="dialog"
          aria-label={t('map.mapSettings')}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-2xs font-semibold text-txt-primary">{t('map.mapSettings')}</p>
            <div className="flex items-center gap-1">
              {/* Саме `.btn-icon` без `.btn`: у `.btn` є px-3.5, і на кнопці 24×24
                  вона з'їдала всю ширину — іконка стискалась до нуля. */}
              <button
                type="button"
                onClick={() => setPrefs(resetMapPrefs())}
                title={t('map.resetToDefaults')}
                aria-label={t('map.resetToDefaults')}
                className="btn-icon h-6 w-6"
              >
                <RotateCcw className="h-3 w-3 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
                className="btn-icon h-6 w-6"
              >
                <X className="h-3 w-3 shrink-0" />
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <Section title={t('map.basemap')}>
              <div className="grid grid-cols-3 gap-1.5">
                {[{ id: AUTO_BASEMAP, label: 'map.basemapAuto', def: autoDef }, ...BASEMAPS.map((b) => ({ id: b.id, label: b.label, def: b }))].map(
                  (item) => {
                    const active = prefs.basemap === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => patch({ basemap: item.id })}
                        aria-pressed={active}
                        title={t(item.label)}
                        className={`group overflow-hidden rounded-control border text-left transition-colors ${
                          active
                            ? 'border-accent bg-accent-soft'
                            : 'border-bdr-subtle hover:border-bdr-strong'
                        }`}
                      >
                        {/* Прев'ю — справжня плитка провайдера над Україною. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl(item.def)}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          className="h-10 w-full object-cover"
                        />
                        <span
                          className={`block truncate px-1.5 py-1 text-micro font-medium ${
                            active ? 'text-txt-primary' : 'text-txt-secondary'
                          }`}
                        >
                          {t(item.label)}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </Section>

            <Section title={t('map.appearance')}>
              <Row label={t('map.labelsOverlay')} hint={t('map.labelsOverlayHint')}>
                <Segmented
                  value={prefs.labels}
                  onChange={(labels) => patch({ labels })}
                  options={[
                    { value: 'auto', label: t('map.auto') },
                    { value: 'on', label: t('map.on') },
                    { value: 'off', label: t('map.off') },
                  ]}
                />
              </Row>
              <Row label={t('map.opacity')}>
                <Slider
                  label={t('map.opacity')}
                  value={prefs.opacity}
                  min={0.2}
                  max={1}
                  step={0.05}
                  onChange={(opacity) => patch({ opacity })}
                />
              </Row>
              <Row label={t('map.brightness')}>
                <Slider
                  label={t('map.brightness')}
                  value={prefs.brightness}
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  onChange={(brightness) => patch({ brightness })}
                />
              </Row>
              <Row label={t('map.contrast')}>
                <Slider
                  label={t('map.contrast')}
                  value={prefs.contrast}
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  onChange={(contrast) => patch({ contrast })}
                />
              </Row>
              <Row label={t('map.grayscale')} hint={t('map.grayscaleHint')}>
                <Switch
                  label={t('map.grayscale')}
                  checked={prefs.grayscale}
                  onChange={(grayscale) => patch({ grayscale })}
                />
              </Row>
            </Section>

            <Section title={t('map.controls')}>
              <Row label={t('map.zoomButtons')}>
                <Switch
                  label={t('map.zoomButtons')}
                  checked={prefs.zoomControl}
                  onChange={(zoomControl) => patch({ zoomControl })}
                />
              </Row>
              <Row label={t('map.scaleBar')}>
                <Segmented<ScaleMode>
                  value={prefs.scale}
                  onChange={(scale) => patch({ scale })}
                  options={[
                    { value: 'off', label: t('map.off') },
                    { value: 'metric', label: t('map.metric') },
                    { value: 'imperial', label: t('map.imperial') },
                    { value: 'both', label: t('map.both') },
                  ]}
                />
              </Row>
              <Row label={t('map.fullscreenButton')}>
                <Switch
                  label={t('map.fullscreenButton')}
                  checked={prefs.fullscreenControl}
                  onChange={(fullscreenControl) => patch({ fullscreenControl })}
                />
              </Row>
              <Row label={t('map.locateButton')} hint={t('map.locateButtonHint')}>
                <Switch
                  label={t('map.locateButton')}
                  checked={prefs.locateControl}
                  onChange={(locateControl) => patch({ locateControl })}
                />
              </Row>
              <Row label={t('map.coordinatesReadout')}>
                <Switch
                  label={t('map.coordinatesReadout')}
                  checked={prefs.coordinates}
                  onChange={(coordinates) => patch({ coordinates })}
                />
              </Row>
              <Row label={t('map.attribution')} hint={t('map.attributionHint')}>
                <Switch
                  label={t('map.attribution')}
                  checked={prefs.attribution}
                  onChange={(attribution) => patch({ attribution })}
                />
              </Row>
            </Section>

            <Section title={t('map.interaction')}>
              <Row label={t('map.scrollWheelZoom')}>
                <Switch
                  label={t('map.scrollWheelZoom')}
                  checked={prefs.scrollWheelZoom}
                  onChange={(scrollWheelZoom) => patch({ scrollWheelZoom })}
                />
              </Row>
              <Row label={t('map.doubleClickZoom')}>
                <Switch
                  label={t('map.doubleClickZoom')}
                  checked={prefs.doubleClickZoom}
                  onChange={(doubleClickZoom) => patch({ doubleClickZoom })}
                />
              </Row>
              <Row label={t('map.dragging')}>
                <Switch
                  label={t('map.dragging')}
                  checked={prefs.dragging}
                  onChange={(dragging) => patch({ dragging })}
                />
              </Row>
              <Row label={t('map.inertia')} hint={t('map.inertiaHint')}>
                <Switch
                  label={t('map.inertia')}
                  checked={prefs.inertia}
                  onChange={(inertia) => patch({ inertia })}
                />
              </Row>
              <Row label={t('map.keyboard')} hint={t('map.keyboardHint')}>
                <Switch
                  label={t('map.keyboard')}
                  checked={prefs.keyboard}
                  onChange={(keyboard) => patch({ keyboard })}
                />
              </Row>
              <Row label={t('map.boxZoom')} hint={t('map.boxZoomHint')}>
                <Switch
                  label={t('map.boxZoom')}
                  checked={prefs.boxZoom}
                  onChange={(boxZoom) => patch({ boxZoom })}
                />
              </Row>
              <Row label={t('map.worldCopyJump')} hint={t('map.worldCopyJumpHint')}>
                <Switch
                  label={t('map.worldCopyJump')}
                  checked={prefs.worldCopyJump}
                  onChange={(worldCopyJump) => patch({ worldCopyJump })}
                />
              </Row>
              <Row label={t('map.zoomStep')} hint={t('map.zoomStepHint')}>
                <Segmented<number>
                  value={prefs.zoomSnap}
                  onChange={(zoomSnap) => patch({ zoomSnap })}
                  options={[
                    { value: 1, label: '1' },
                    { value: 0.5, label: '½' },
                    { value: 0.25, label: '¼' },
                  ]}
                />
              </Row>
            </Section>
          </div>

          <p className="mt-2.5 border-t border-bdr-subtle pt-2 text-micro text-txt-muted">
            {t('map.savedLocally')}
          </p>
        </div>
      )}
    </div>
  );
}
