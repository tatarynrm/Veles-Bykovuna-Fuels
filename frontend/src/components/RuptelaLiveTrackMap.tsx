'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '@/context/ThemeContext';
import { NO_DATA, metric, type RuptelaTrackPoint } from '@/lib/ruptela';

interface RuptelaLiveTrackMapProps {
  /** Oldest-first, exactly as the API returns them. */
  points: RuptelaTrackPoint[];
  plate: string;
  /** Keep the newest fix centred as it moves. */
  follow: boolean;
  /** Bumped by the page to re-fit the whole track into view. */
  fitKey: number;
}

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

/**
 * Leaflet takes literal color strings, so theme tokens are resolved from the
 * document at draw time rather than through Tailwind classes — that keeps the
 * track following the theme instead of freezing one palette into the component.
 */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export default function RuptelaLiveTrackMap({
  points,
  plate,
  follow,
  fitKey,
}: RuptelaLiveTrackMapProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const casingRef = useRef<L.Polyline | null>(null);
  const trackRef = useRef<L.Polyline | null>(null);
  const startRef = useRef<L.CircleMarker | null>(null);
  const currentRef = useRef<L.Marker | null>(null);
  /** The first fix arrives after the map mounts, so the initial fit is deferred. */
  const hasFittedRef = useRef(false);

  /* Init once */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [48.8, 27.5],
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
    });

    tileLayerRef.current = L.tileLayer(theme === 'light' ? TILES.light : TILES.dark, {
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      casingRef.current = null;
      trackRef.current = null;
      startRef.current = null;
      currentRef.current = null;
    };
    // Theme is only read for the initial tile URL; the swap below keeps it in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Swap basemap with the theme */
  useEffect(() => {
    tileLayerRef.current?.setUrl(theme === 'light' ? TILES.light : TILES.dark);
  }, [theme]);

  /* Draw the track */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // A record with no GPS fix is dropped rather than drawn at a default coordinate —
    // an invented point would bend the route through a place the truck never was.
    const located = points.filter(
      (p) => p.latitude !== null && p.longitude !== null,
    ) as Array<RuptelaTrackPoint & { latitude: number; longitude: number }>;

    const path = located.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
    const accent = token('--warn', 'rgb(245 165 36)');
    const muted = token('--text-muted', '#6B7688');

    if (path.length === 0) {
      casingRef.current?.remove();
      trackRef.current?.remove();
      startRef.current?.remove();
      currentRef.current?.remove();
      casingRef.current = null;
      trackRef.current = null;
      startRef.current = null;
      currentRef.current = null;
      hasFittedRef.current = false;
      return;
    }

    // Casing under the line keeps the route readable over both basemaps.
    if (casingRef.current) {
      casingRef.current.setLatLngs(path);
    } else {
      casingRef.current = L.polyline(path, {
        color: '#000',
        opacity: 0.28,
        weight: 7,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);
    }

    if (trackRef.current) {
      trackRef.current.setLatLngs(path);
      trackRef.current.setStyle({ color: accent });
    } else {
      trackRef.current = L.polyline(path, {
        color: accent,
        opacity: 0.95,
        weight: 3,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);
    }

    const first = path[0];
    if (startRef.current) {
      startRef.current.setLatLng(first);
      startRef.current.setStyle({ color: muted });
    } else {
      startRef.current = L.circleMarker(first, {
        radius: 5,
        color: muted,
        weight: 2,
        fillColor: muted,
        fillOpacity: 0.55,
      })
        .bindTooltip('Початок треку', { direction: 'top' })
        .addTo(map);
    }

    const last = located[located.length - 1];
    const moving = (last.speed ?? 0) > 5;
    const heading = last.heading ?? 0;

    const iconHtml = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center">
        <div style="
          position:relative;width:30px;height:30px;border-radius:9999px;
          display:flex;align-items:center;justify-content:center;
          background:${accent};border:2px solid rgba(255,255,255,.9);
          box-shadow:0 6px 16px -4px rgba(0,0,0,.55)">
          ${
            moving
              ? `<span style="position:absolute;inset:-3px;border-radius:9999px;background:${accent};opacity:.45;animation:liveTrackPing 1.8s cubic-bezier(0,0,.2,1) infinite"></span>`
              : ''
          }
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1A1206"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
               style="position:relative;z-index:1;transform:rotate(${heading}deg)">
            <path d="M12 3 L19 20 L12 16 L5 20 Z"/>
          </svg>
        </div>
        <div style="
          margin-top:4px;padding:2px 7px;border-radius:7px;white-space:nowrap;
          font-size:10px;font-weight:600;letter-spacing:.02em;
          background:rgba(10,14,20,.88);color:#fff;border:1px solid rgba(255,255,255,.16)">
          ${plate || 'ТЗ'} · ${last.speed !== null ? `${Math.round(last.speed)} км/год` : NO_DATA}
        </div>
      </div>
      <style>@keyframes liveTrackPing{75%,100%{transform:scale(2);opacity:0}}</style>
    `;

    const icon = L.divIcon({
      html: iconHtml,
      className: 'ruptela-live-marker',
      iconSize: [44, 52],
      iconAnchor: [22, 26],
    });

    const tooltip = `
      <div style="font-size:11px;line-height:1.5">
        <strong>${new Date(last.datetime).toLocaleTimeString('uk-UA')}</strong><br/>
        Швидкість: ${metric(last.speed, { unit: 'км/год' })}<br/>
        Пальне: ${metric(last.fuel_level_liters, { unit: 'л', digits: 1 })}<br/>
        Супутники: ${metric(last.satellites)}
      </div>
    `;

    const position: L.LatLngTuple = [last.latitude, last.longitude];
    if (currentRef.current) {
      currentRef.current.setLatLng(position);
      currentRef.current.setIcon(icon);
      currentRef.current.setTooltipContent(tooltip);
    } else {
      currentRef.current = L.marker(position, { icon, zIndexOffset: 1000 })
        .bindTooltip(tooltip, { direction: 'top', offset: [0, -20] })
        .addTo(map);
    }

    if (!hasFittedRef.current) {
      hasFittedRef.current = true;
      map.fitBounds(L.latLngBounds(path).pad(0.25), { maxZoom: 15 });
    } else if (follow) {
      map.panTo(position, { animate: true });
    }
  }, [points, plate, follow]);

  /* Re-fit on demand (vehicle switched, or the dispatcher pressed "fit") */
  useEffect(() => {
    const map = mapRef.current;
    const bounds = trackRef.current?.getBounds();

    // Fit right away when there is already a track — waiting for the next poll
    // would make the button look dead for up to a full interval. With no track
    // yet (vehicle just switched), arm the fit for the first batch instead.
    if (map && bounds?.isValid()) {
      map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
      hasFittedRef.current = true;
    } else {
      hasFittedRef.current = false;
    }
  }, [fitKey]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-card border border-bdr-subtle lg:h-[520px]">
      <div ref={containerRef} className="z-0 h-full w-full" />

      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
          <p className="glass-float rounded-field px-3 py-2 text-2xs text-txt-secondary">
            Немає координат за обраним вікном
          </p>
        </div>
      )}
    </div>
  );
}
