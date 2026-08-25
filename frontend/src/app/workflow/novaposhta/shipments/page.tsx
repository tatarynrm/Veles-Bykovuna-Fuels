'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import NovaPoshtaShell from '@/components/NovaPoshtaShell';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  listShipments,
  toNovaPoshtaDate,
  NO_DATA,
  type NovaPoshtaShipment,
} from '@/lib/novaposhta';
import {
  Boxes,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
} from 'lucide-react';
import { t } from '@/lib/i18n';

/** ISO YYYY-MM-DD for the native date inputs. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function NovaPoshtaShipmentsPage() {
  const { authenticated } = useAuthGuard();

  const today = new Date();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000);

  const [from, setFrom] = useState(isoDate(twoWeeksAgo));
  const [to, setTo] = useState(isoDate(today));
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<NovaPoshtaShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listShipments({
          dateFrom: toNovaPoshtaDate(new Date(from)),
          dateTo: toNovaPoshtaDate(new Date(to)),
          page: pageNum,
          limit: 50,
        });
        setRows(res.items);
        setPage(res.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [from, to],
  );

  useEffect(() => {
    if (authenticated) load(1);
  }, [authenticated, load]);

  if (!authenticated) return null;

  return (
    <NovaPoshtaShell
      title={t('nova.shipmentsTitle')}
      subtitle={t('nova.shipmentsSubtitle')}
      status={
        rows.length > 0 ? (
          <span className="badge badge-accent">{t('nova.parcelsCount', { v0: rows.length })}</span>
        ) : undefined
      }
      actions={
        <button
          type="button"
          onClick={() => load(page)}
          className="btn btn-ghost"
          disabled={loading}
          title={t('nova.refresh')}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('nova.refresh')}</span>
        </button>
      }
    >
      {/* Date range */}
      <section className="glass-panel flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="micro-label mb-1.5 block">{t('nova.dateFrom')}</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="field" />
        </div>
        <div>
          <label className="micro-label mb-1.5 block">{t('nova.dateTo')}</label>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="field" />
        </div>
        <button type="button" onClick={() => load(1)} className="btn btn-primary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
          <span>{t('nova.show')}</span>
        </button>
      </section>

      {error && (
        <div className="flex items-start gap-2.5 rounded-field border border-warn/30 bg-warn/10 px-3 py-2.5 text-2xs text-warn">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-txt-secondary">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-panel space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded-control" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <section className="glass-panel flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-accent-soft text-accent">
            <Boxes className="h-5 w-5" />
          </span>
          <h2 className="text-sm font-semibold text-txt-primary">{t('nova.noShipments')}</h2>
          <p className="max-w-md text-2xs leading-relaxed text-txt-secondary">
            {t('nova.noShipmentsHint')}
          </p>
        </section>
      ) : (
        <div className="glass-panel overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t('nova.colNumber')}</th>
                <th>{t('nova.colDate')}</th>
                <th>{t('nova.recipient')}</th>
                <th>{t('nova.colCity')}</th>
                <th>{t('nova.colNotes')}</th>
                <th>{t('nova.colState')}</th>
                <th className="text-right">{t('nova.weight')}</th>
                <th className="text-right">{t('nova.colCost')}</th>
                <th className="text-right">{t('nova.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // Cargo description + any dispatcher notes, de-duplicated.
                const notes = Array.from(
                  new Set(
                    [r.description, r.additional_information, r.note].filter(
                      (s): s is string => !!s && s.trim().length > 0,
                    ),
                  ),
                );
                return (
                  <tr key={r.ref ?? r.number}>
                    <td className="font-mono font-medium text-txt-primary">{r.number}</td>
                    <td className="whitespace-nowrap text-txt-secondary">
                      {r.date_created ? formatDate(r.date_created) : NO_DATA}
                    </td>
                    <td>
                      <div className="font-medium text-txt-primary">
                        {r.recipient_name ?? r.recipient_company ?? NO_DATA}
                      </div>
                      {r.recipient_phone && (
                        <div className="text-micro text-txt-muted">{r.recipient_phone}</div>
                      )}
                      {r.recipient_company && r.recipient_company !== r.recipient_name && (
                        <div className="truncate text-micro text-txt-muted">{r.recipient_company}</div>
                      )}
                    </td>
                    <td>
                      <div className="text-txt-primary">{r.city_recipient ?? NO_DATA}</div>
                      {r.warehouse_recipient && (
                        <div className="max-w-[220px] truncate text-micro text-txt-muted" title={r.warehouse_recipient}>
                          {r.warehouse_recipient}
                        </div>
                      )}
                    </td>
                    <td>
                      {notes.length > 0 ? (
                        <span
                          className="line-clamp-2 max-w-[240px] text-2xs text-txt-secondary"
                          title={notes.join(' · ')}
                        >
                          {notes.join(' · ')}
                        </span>
                      ) : (
                        <span className="text-txt-muted">{NO_DATA}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{r.state_name ?? NO_DATA}</span>
                    </td>
                    <td className="text-right text-txt-secondary">
                      {r.weight != null ? `${r.weight} ${t('unit.kg')}` : NO_DATA}
                    </td>
                    <td className="text-right font-medium text-txt-primary">
                      {r.cost_on_site != null ? formatCurrency(r.cost_on_site) : NO_DATA}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/workflow/novaposhta/track?numbers=${r.number}`}
                        className="btn btn-ghost btn-icon"
                        title={t('nova.tracking')}
                      >
                        <PackageSearch className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination — the register endpoint pages server-side. */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => load(Math.max(1, page - 1))}
            disabled={loading || page <= 1}
            className="btn btn-ghost"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{t('nova.prev')}</span>
          </button>
          <span className="text-2xs text-txt-muted">{t('nova.pageN', { v0: page })}</span>
          <button
            type="button"
            onClick={() => load(page + 1)}
            disabled={loading || rows.length < 50}
            className="btn btn-ghost"
          >
            <span>{t('nova.next')}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </NovaPoshtaShell>
  );
}
