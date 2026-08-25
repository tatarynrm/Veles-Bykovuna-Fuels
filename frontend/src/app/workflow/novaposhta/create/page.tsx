'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import NovaPoshtaShell from '@/components/NovaPoshtaShell';
import { GuestBlockedPanel } from '@/components/GuestLock';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { formatCurrency } from '@/lib/format';
import {
  createShipment,
  getSender,
  searchCities,
  listWarehouses,
  type NovaPoshtaCity,
  type NovaPoshtaWarehouse,
  type NovaPoshtaSender,
  type CreateShipmentResult,
} from '@/lib/novaposhta';
import {
  PackagePlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  MapPin,
  Building2,
  User,
  Truck,
  Copy,
  PackageSearch,
} from 'lucide-react';
import { t } from '@/lib/i18n';

/** Nova Poshta delivery services offered in the form. */
const SERVICE_TYPES = [
  { value: 'WarehouseWarehouse', label: 'nova.svcWW' },
  { value: 'WarehouseDoors', label: 'nova.svcWD' },
];

export default function NovaPoshtaCreatePage() {
  const { authenticated, isGuest } = useAuthGuard();

  const [sender, setSender] = useState<NovaPoshtaSender | null>(null);
  const [senderErr, setSenderErr] = useState<string | null>(null);

  // Sender location (from the API key's account; dispatcher confirms/picks it).
  const [senderCity, setSenderCity] = useState<NovaPoshtaCity | null>(null);
  const [senderWh, setSenderWh] = useState<NovaPoshtaWarehouse | null>(null);

  // Recipient
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [recipientCity, setRecipientCity] = useState<NovaPoshtaCity | null>(null);
  const [recipientWh, setRecipientWh] = useState<NovaPoshtaWarehouse | null>(null);

  // Cargo
  const [weight, setWeight] = useState('1');
  const [seats, setSeats] = useState('1');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('500');
  const [serviceType, setServiceType] = useState('WarehouseWarehouse');
  const [payerType, setPayerType] = useState<'Sender' | 'Recipient'>('Recipient');
  const [cod, setCod] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateShipmentResult | null>(null);

  useEffect(() => {
    if (!authenticated || isGuest) return;
    getSender()
      .then((s) => {
        setSender(s);
        if (s.city_ref && s.city_name) {
          setSenderCity({ ref: s.city_ref, name: s.city_name, area: null, settlement_type: null });
        }
      })
      .catch((e) => setSenderErr(e instanceof Error ? e.message : String(e)));
  }, [authenticated, isGuest]);

  const canSubmit =
    !!senderCity &&
    !!senderWh &&
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    !!recipientCity &&
    !!recipientWh &&
    Number(weight) > 0 &&
    description.trim() &&
    Number(cost) > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !senderCity || !senderWh || !recipientCity || !recipientWh) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await createShipment({
        recipientFirstName: firstName.trim(),
        recipientLastName: lastName.trim(),
        recipientMiddleName: middleName.trim() || undefined,
        recipientPhone: phone.trim(),
        recipientCityRef: recipientCity.ref,
        recipientWarehouseRef: recipientWh.ref,
        weight: Number(weight),
        seatsAmount: Number(seats) || 1,
        description: description.trim(),
        cost: Number(cost),
        serviceType,
        payerType,
        backwardMoney: cod ? Number(cod) : undefined,
        senderCityRef: senderCity.ref,
        senderWarehouseRef: senderWh.ref,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!authenticated) return null;

  if (isGuest) {
    return (
      <NovaPoshtaShell title={t('nova.createTitle')} subtitle={t('nova.createSubtitle')}>
        <GuestBlockedPanel description={t('nova.guestBlocked')} />
      </NovaPoshtaShell>
    );
  }

  // Success screen replaces the form so a TTN can't be created twice by accident.
  if (result) {
    return (
      <NovaPoshtaShell title={t('nova.createTitle')} subtitle={t('nova.createSubtitle')}>
        <section className="glass-panel flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-panel bg-accent-soft text-accent">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-txt-primary">{t('nova.createdTitle')}</h2>
            <p className="mt-1 text-2xs text-txt-secondary">{t('nova.createdSubtitle')}</p>
          </div>

          <div className="glass-inset flex items-center gap-3 px-5 py-3">
            <span className="font-mono text-xl font-bold tracking-wider text-txt-primary">
              {result.number}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(result.number)}
              className="btn btn-icon btn-ghost"
              title={t('nova.copy')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-2xs">
            {result.cost_on_site != null && (
              <>
                <dt className="text-txt-muted">{t('nova.deliveryCost')}</dt>
                <dd className="text-right font-medium text-txt-primary">
                  {formatCurrency(result.cost_on_site)}
                </dd>
              </>
            )}
            {result.estimated_delivery_date && (
              <>
                <dt className="text-txt-muted">{t('nova.estDelivery')}</dt>
                <dd className="text-right font-medium text-txt-primary">
                  {result.estimated_delivery_date}
                </dd>
              </>
            )}
          </dl>

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link
              href={`/workflow/novaposhta/track?numbers=${result.number}`}
              className="btn btn-primary"
            >
              <PackageSearch className="h-4 w-4" />
              <span>{t('nova.trackIt')}</span>
            </Link>
            <button type="button" onClick={() => setResult(null)} className="btn btn-ghost">
              <PackagePlus className="h-4 w-4" />
              <span>{t('nova.createAnother')}</span>
            </button>
          </div>
        </section>
      </NovaPoshtaShell>
    );
  }

  return (
    <NovaPoshtaShell title={t('nova.createTitle')} subtitle={t('nova.createSubtitle')}>
      <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-2">
        {/* Sender */}
        <section className="glass-panel space-y-4 p-4 sm:p-5">
          <SectionHeader icon={Truck} title={t('nova.senderTitle')} subtitle={t('nova.senderSubtitle')} />
          {senderErr ? (
            <InlineError text={senderErr} />
          ) : sender ? (
            <p className="text-2xs text-txt-secondary">
              <span className="font-medium text-txt-primary">{sender.contact_name ?? t('nova.account')}</span>
              {sender.phone ? ` · ${sender.phone}` : ''}
            </p>
          ) : (
            <p className="text-2xs text-txt-muted">{t('nova.loadingSender')}</p>
          )}

          <CityPicker
            label={t('nova.senderCity')}
            value={senderCity}
            onChange={(c) => {
              setSenderCity(c);
              setSenderWh(null);
            }}
          />
          <WarehousePicker
            label={t('nova.senderWarehouse')}
            cityRef={senderCity?.ref ?? null}
            value={senderWh}
            onChange={setSenderWh}
          />
        </section>

        {/* Recipient */}
        <section className="glass-panel space-y-4 p-4 sm:p-5">
          <SectionHeader icon={User} title={t('nova.recipientTitle')} subtitle={t('nova.recipientSubtitle')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('nova.lastName')} required>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="field w-full" />
            </Field>
            <Field label={t('nova.firstName')} required>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field w-full" />
            </Field>
            <Field label={t('nova.middleName')}>
              <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="field w-full" />
            </Field>
            <Field label={t('nova.phone')} required>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380…"
                inputMode="tel"
                className="field w-full"
              />
            </Field>
          </div>
          <CityPicker
            label={t('nova.recipientCity')}
            value={recipientCity}
            onChange={(c) => {
              setRecipientCity(c);
              setRecipientWh(null);
            }}
          />
          <WarehousePicker
            label={t('nova.recipientWarehouse')}
            cityRef={recipientCity?.ref ?? null}
            value={recipientWh}
            onChange={setRecipientWh}
          />
        </section>

        {/* Cargo */}
        <section className="glass-panel space-y-4 p-4 sm:p-5 lg:col-span-2">
          <SectionHeader icon={PackagePlus} title={t('nova.cargoTitle')} subtitle={t('nova.cargoSubtitle')} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('nova.weightKg')} required>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="field w-full"
              />
            </Field>
            <Field label={t('nova.seats')}>
              <input
                type="number"
                min="1"
                step="1"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="field w-full"
              />
            </Field>
            <Field label={t('nova.declaredCost')} required>
              <input
                type="number"
                min="1"
                step="1"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="field w-full"
              />
            </Field>
            <Field label={t('nova.codAmount')}>
              <input
                type="number"
                min="0"
                step="1"
                value={cod}
                onChange={(e) => setCod(e.target.value)}
                placeholder="0"
                className="field w-full"
              />
            </Field>
            <Field label={t('nova.service')}>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="field w-full">
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('nova.payer')}>
              <select
                value={payerType}
                onChange={(e) => setPayerType(e.target.value as 'Sender' | 'Recipient')}
                className="field w-full"
              >
                <option value="Recipient">{t('nova.payerRecipient')}</option>
                <option value="Sender">{t('nova.payerSender')}</option>
              </select>
            </Field>
            <Field label={t('nova.description')} required className="sm:col-span-2">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('nova.descriptionPlaceholder')}
                className="field w-full"
              />
            </Field>
          </div>
        </section>

        {error && (
          <div className="lg:col-span-2">
            <InlineError text={error} />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 lg:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            <span>{t('nova.createButton')}</span>
          </button>
        </div>
      </form>
    </NovaPoshtaShell>
  );
}

/* ── building blocks ────────────────────────────────────────────────────── */

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-txt-primary">{title}</h2>
        <p className="text-micro text-txt-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="micro-label mb-1.5 block">
        {label}
        {required && <span className="text-warn"> *</span>}
      </label>
      {children}
    </div>
  );
}

function InlineError({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-field border border-warn/30 bg-warn/10 px-3 py-2.5 text-2xs text-warn">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="text-txt-secondary">{text}</span>
    </div>
  );
}

/** Debounce a changing value by `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Async city combobox — Nova Poshta Address.getCities behind a debounced search. */
function CityPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: NovaPoshtaCity | null;
  onChange: (c: NovaPoshtaCity | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<NovaPoshtaCity[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 300);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || debounced.trim().length < 2) {
      setOptions([]);
      return;
    }
    let alive = true;
    setLoading(true);
    searchCities(debounced.trim())
      .then((rows) => alive && setOptions(rows))
      .catch(() => alive && setOptions([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [debounced, open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <label className="micro-label mb-1.5 block">
        {label}
        <span className="text-warn"> *</span>
      </label>
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery('');
            setOpen(true);
          }}
          className="field flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate text-txt-primary">{value.name}</span>
            {value.area && <span className="truncate text-txt-muted">· {value.area}</span>}
          </span>
          <span className="text-micro text-txt-muted">{t('nova.change')}</span>
        </button>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={t('nova.cityPlaceholder')}
            className="field w-full pl-9"
          />
        </div>
      )}

      {open && !value && (query.trim().length >= 2) && (
        <div className="glass-panel absolute z-40 mt-1 max-h-60 w-full overflow-y-auto p-1 shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-2xs text-txt-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('nova.searching')}
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-2xs text-txt-muted">{t('nova.nothingFound')}</div>
          ) : (
            options.map((c) => (
              <button
                key={c.ref}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-2xs text-txt-secondary hover:bg-surface-hover hover:text-txt-primary"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-txt-muted" />
                <span className="truncate">{c.name}</span>
                {c.area && <span className="truncate text-txt-muted">· {c.area}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Warehouse combobox for a chosen city — Nova Poshta Address.getWarehouses. */
function WarehousePicker({
  label,
  cityRef,
  value,
  onChange,
}: {
  label: string;
  cityRef: string | null;
  value: NovaPoshtaWarehouse | null;
  onChange: (w: NovaPoshtaWarehouse | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<NovaPoshtaWarehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounced(query, 300);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !cityRef) {
      setOptions([]);
      return;
    }
    let alive = true;
    setLoading(true);
    listWarehouses(cityRef, debounced.trim() || undefined)
      .then((rows) => alive && setOptions(rows))
      .catch(() => alive && setOptions([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [cityRef, debounced, open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const disabled = !cityRef;

  return (
    <div ref={boxRef} className="relative">
      <label className="micro-label mb-1.5 block">
        {label}
        <span className="text-warn"> *</span>
      </label>
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery('');
            setOpen(true);
          }}
          className="field flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate text-txt-primary">{value.description ?? `№${value.number}`}</span>
          </span>
          <span className="text-micro text-txt-muted">{t('nova.change')}</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="field flex w-full items-center gap-2 text-left text-txt-muted disabled:opacity-50"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{disabled ? t('nova.pickCityFirst') : t('nova.pickWarehouse')}</span>
        </button>
      )}

      {open && !value && cityRef && (
        <div className="glass-panel absolute z-40 mt-1 w-full p-1 shadow-lg">
          <div className="relative p-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder={t('nova.warehousePlaceholder')}
              className="field w-full pl-9"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-2xs text-txt-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('nova.searching')}
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-2 text-2xs text-txt-muted">{t('nova.nothingFound')}</div>
            ) : (
              options.map((w) => (
                <button
                  key={w.ref}
                  type="button"
                  onClick={() => {
                    onChange(w);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-control px-3 py-2 text-left text-2xs text-txt-secondary hover:bg-surface-hover hover:text-txt-primary"
                >
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-txt-muted" />
                  <span className="truncate">{w.description ?? `№${w.number}`}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
