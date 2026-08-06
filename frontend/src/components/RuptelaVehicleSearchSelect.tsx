'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Truck, Search, Check, ChevronDown, X } from 'lucide-react';
import { NO_DATA, STATUS_LABEL, metric, type RuptelaVehicle } from '@/lib/ruptela';
import { t } from '@/lib/i18n';

interface RuptelaVehicleSearchSelectProps {
  vehicles: RuptelaVehicle[];
  selectedVehicleId: string;
  onSelectVehicle: (vehicle: RuptelaVehicle) => void;
  label?: string;
}

/**
 * Vehicle picker for trip planning.
 *
 * The driver is not editable here: Ruptela derives a trip's driver from the
 * vehicle assignment (`vehicle.primaryDriver`), so the picker shows who is
 * actually assigned instead of letting a dispatcher type a name that the API
 * would silently ignore.
 */
export default function RuptelaVehicleSearchSelect({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  label = t('telematics.vehicleRuptela'),
}: RuptelaVehicleSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [makeFilter, setMakeFilter] = useState('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const makes = useMemo(() => {
    const found = new Set(
      vehicles.map((v) => (v.make || '').toUpperCase().trim()).filter(Boolean),
    );
    return ['ALL', ...Array.from(found).sort()].slice(0, 6);
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vehicles.filter((v) => {
      const matchesQuery =
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q) ||
        (v.driver_name ?? '').toLowerCase().includes(q) ||
        (v.make ?? '').toLowerCase().includes(q);
      const matchesMake =
        makeFilter === 'ALL' || (v.make ?? '').toUpperCase().includes(makeFilter);
      return matchesQuery && matchesMake;
    });
  }, [vehicles, search, makeFilter]);

  const statusDot = (v: RuptelaVehicle) =>
    v.status === 'moving'
      ? 'bg-accent'
      : v.status === 'idle'
        ? 'bg-warn'
        : v.status === 'offline'
          ? 'bg-danger'
          : 'bg-txt-muted';

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-20'}`} ref={dropdownRef}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="micro-label">{label}</span>
        <span className="font-mono text-micro text-txt-muted">{vehicles.length} {t('common.vehicleShort')}</span>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="glass-inset glass-inset-hover flex w-full items-center justify-between gap-3 p-3 text-left transition-colors"
      >
        {selected ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-warn/10 text-warn">
              <Truck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-medium text-txt-primary">
                  {selected.name}
                </span>
                <span className="badge badge-warn">{selected.plate}</span>
              </div>
              <p className="mt-0.5 truncate text-micro text-txt-muted">
                {selected.make} {selected.model} {t('telematics.driverColon')} {selected.driver_name ?? NO_DATA}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-txt-muted">{t('telematics.selectAVehicleEllipsis')}</span>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {selected && (
            <span className="badge badge-neutral">{STATUS_LABEL[selected.status]}</span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-txt-muted transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="glass-float animate-pop absolute left-0 right-0 top-full z-50 mt-2 flex max-h-[380px] flex-col gap-2.5 rounded-card p-3">
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('telematics.plateMakeDriverEllipsis')}
              autoFocus
              className="field field-sm pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('telematics.clearSearch')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-0.5">
            {makes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMakeFilter(m)}
                className={`shrink-0 rounded-control px-2.5 py-1 text-micro font-semibold transition-colors ${
                  makeFilter === m
                    ? 'bg-warn text-[#1A1206]'
                    : 'bg-surface-hover text-txt-secondary hover:text-txt-primary'
                }`}
              >
                {m === 'ALL' ? t('telematics.allBrands') : m}
              </button>
            ))}
            <span className="ml-auto shrink-0 pl-2 font-mono text-micro text-txt-muted">
              {filtered.length}
            </span>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto pr-0.5" role="listbox">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-2xs text-txt-muted">
                {t('telematics.noVehiclesFound')}
              </p>
            ) : (
              filtered.map((v) => {
                const isSelected = v.id === selectedVehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectVehicle(v);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-field border p-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-warn/40 bg-warn/10'
                        : 'border-transparent hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(v)}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-2xs font-medium text-txt-primary">
                            {v.name}
                          </span>
                          <span className="font-mono text-micro font-semibold text-warn">
                            {v.plate}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-micro text-txt-muted">
                          {t('telematics.driverColon2')} {v.driver_name ?? NO_DATA}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular font-mono text-micro text-txt-muted">
                        {metric(v.telemetry.speed, { unit: t('unit.kmh') })}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-warn" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
