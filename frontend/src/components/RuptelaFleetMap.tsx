'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTheme } from '@/context/ThemeContext';
import { NO_DATA, STATUS_LABEL, metric, type RuptelaVehicle } from '@/lib/ruptela';
import { t } from '@/lib/i18n';
import { getMapPrefs, onMapPrefsChange } from '@/lib/mapPrefs';
import {
  applyMapPrefs,
  createHandles,
  disposeHandles,
  drawUserLocation,
  type MapHandles,
} from '@/lib/mapRuntime';
import MapSettingsPanel from './MapSettingsPanel';

interface RuptelaFleetMapProps {
  vehicles: RuptelaVehicle[];
  selectedVehicle: RuptelaVehicle | null;
  onSelectVehicle: (vehicle: RuptelaVehicle) => void;
  onCreateTrip: (vehicleId: string) => void;
  /** False for a guest session — the popup then offers no write action. */
  canCreateTrip?: boolean;
}

const STATUS_COLOR = {
  moving: '#10B981',
  idle: '#F5A524',
  stopped: '#6B7688',
  offline: '#F0576B',
} as const;

export default function RuptelaFleetMap({
  vehicles,
  selectedVehicle,
  onSelectVehicle,
  onCreateTrip,
  canCreateTrip = true,
}: RuptelaFleetMapProps) {
  const { theme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const handlesRef = useRef<MapHandles | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  /* Init once */
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // zoomControl вимкнено, бо його додає applyMapPrefs; attributionControl,
    // навпаки, потрібен від початку — інакше плитка не зареєструє свій підпис.
    const map = L.map(mapContainerRef.current, {
      center: [48.8, 27.5],
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
    });

    const handles = createHandles(map);
    handlesRef.current = handles;
    map.on('locationfound', (e) => drawUserLocation(handles, e as L.LocationEvent));
    mapInstanceRef.current = map;

    return () => {
      disposeHandles(handles);
      map.remove();
      mapInstanceRef.current = null;
      handlesRef.current = null;
      markersRef.current = {};
    };
  }, []);

  /* Підкладка й поведінка — з налаштувань користувача, плюс реакція на тему */
  useEffect(() => {
    const apply = () => {
      const handles = handlesRef.current;
      if (handles) applyMapPrefs(handles, getMapPrefs(), theme === 'light' ? 'light' : 'dark');
    };
    apply();
    return onMapPrefsChange(apply);
  }, [theme]);

  /* Sync markers */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // A vehicle with no GPS fix gets no marker — placing it at a default coordinate
    // would put a truck on the map that the API never located.
    const located = vehicles.filter(
      (v) => v.telemetry.latitude !== null && v.telemetry.longitude !== null,
    );

    const liveIds = new Set(located.map((v) => v.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!liveIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    located.forEach((v) => {
      const lat = v.telemetry.latitude as number;
      const lng = v.telemetry.longitude as number;
      const isSelected = selectedVehicle?.id === v.id;
      const color = STATUS_COLOR[v.status] ?? STATUS_COLOR.stopped;
      const label = STATUS_LABEL[v.status];

      const markerHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:${
          isSelected ? 'scale(1.15)' : 'scale(1)'
        };transition:transform .18s cubic-bezier(0.22,1,0.36,1);">
          <div style="
            position:relative;width:26px;height:26px;border-radius:9999px;
            display:flex;align-items:center;justify-content:center;
            background:${color};
            border:2px solid rgba(255,255,255,.85);
            box-shadow:0 4px 12px -2px rgba(0,0,0,.5)${
              isSelected ? `, 0 0 0 4px ${color}55` : ''
            };">
            ${
              v.status === 'moving'
                ? `<span style="position:absolute;inset:-2px;border-radius:9999px;background:${color};opacity:.5;animation:mapPing 1.8s cubic-bezier(0,0,.2,1) infinite;"></span>`
                : ''
            }
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
                 style="position:relative;z-index:1">
              <path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
          <div style="
            margin-top:3px;padding:1px 6px;border-radius:6px;white-space:nowrap;
            font-size:9px;font-weight:600;letter-spacing:.02em;
            background:rgba(10,14,20,.88);color:#fff;
            border:1px solid rgba(255,255,255,.14);">
            ${v.plate}${(v.telemetry.speed ?? 0) > 0 ? ` · ${v.telemetry.speed}` : ''}
          </div>
        </div>
        <style>@keyframes mapPing{75%,100%{transform:scale(2);opacity:0}}</style>
      `;

      const icon = L.divIcon({
        html: markerHtml,
        className: 'ruptela-marker',
        iconSize: [40, 46],
        iconAnchor: [20, 23],
      });

      const popupHtml = `
        <div style="min-width:220px;font-family:inherit">
          <div style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${color}">
            ${v.plate} · ${label}
          </div>
          <div style="font-size:13px;font-weight:600;margin-top:3px;color:var(--text-primary)">
            ${v.name}
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${v.make} ${v.model} · ${v.driver_name ?? NO_DATA}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">
            <div style="padding:6px 8px;border-radius:10px;background:var(--surface-inset);border:1px solid var(--border-subtle)">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${t('common.speed')}</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);font-variant-numeric:tabular-nums">${metric(v.telemetry.speed, { unit: t('unit.kmh') })}</div>
            </div>
            <div style="padding:6px 8px;border-radius:10px;background:var(--surface-inset);border:1px solid var(--border-subtle)">
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">${t('common.fuel')}</div>
              <div style="font-size:13px;font-weight:600;color:var(--accent);font-variant-numeric:tabular-nums">${metric(v.telemetry.fuel_level_percent, { unit: '%', digits: 1 })}</div>
            </div>
          </div>

          ${
            canCreateTrip
              ? `<button id="btn-create-trip-${v.id}" style="
            width:100%;margin-top:10px;padding:7px 12px;border:none;cursor:pointer;
            border-radius:10px;background:var(--warn);color:#1A1206;
            font-size:11px;font-weight:600;font-family:inherit">
            ${t('common.createATrip')}
          </button>`
              : ''
          }
        </div>
      `;

      const existing = markersRef.current[v.id];
      if (existing) {
        existing.setLatLng([lat, lng]);
        existing.setIcon(icon);
        existing.setPopupContent(popupHtml);
      } else {
        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(popupHtml, { className: 'ruptela-popup', closeButton: true });
        marker.on('click', () => onSelectVehicle(v));
        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-create-trip-${v.id}`);
          if (btn) btn.onclick = () => onCreateTrip(v.id);
        });
        markersRef.current[v.id] = marker;
      }
    });

    const focus = selectedVehicle?.telemetry;
    if (selectedVehicle && markersRef.current[selectedVehicle.id] && focus?.latitude !== null && focus?.longitude != null) {
      map.panTo([focus.latitude as number, focus.longitude as number], { animate: true });
    }
  }, [vehicles, selectedVehicle, onSelectVehicle, onCreateTrip, canCreateTrip]);

  const counts = vehicles.reduce(
    (acc, v) => {
      acc[v.status] = (acc[v.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div
      data-map-shell
      className="relative h-[400px] w-full overflow-hidden rounded-card border border-bdr-subtle lg:h-[480px]"
    >
      <div ref={mapContainerRef} className="z-0 h-full w-full" />

      <MapSettingsPanel />

      <div className="glass-float absolute left-3 top-3 z-[400] rounded-field px-3 py-2.5">
        <p className="micro-label mb-1.5">{t('telematics.vehicleStatus')}</p>
        <div className="space-y-1">
          {(['moving', 'idle', 'stopped', 'offline'] as const).map((key) => (
            <div key={key} className="flex items-center gap-2 text-micro">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[key] }}
              />
              <span className="text-txt-secondary">{STATUS_LABEL[key]}</span>
              <span className="tabular ml-auto pl-3 font-medium text-txt-primary">
                {counts[key] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
