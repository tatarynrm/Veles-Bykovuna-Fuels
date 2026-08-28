'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Database, AlertTriangle, Search, Table2 } from 'lucide-react';
import PageShell, { AuthGate } from '@/components/PageShell';
import PaginationBar from '@/components/PaginationBar';
import { SkeletonTable, EmptyState } from '@/components/Skeletons';
import { useAuthGuard } from '@/lib/useAuthGuard';
import { apiObject } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n';

interface OsRow {
  kod: string | number | null;
  pip: string | null;
}

interface OsResponse {
  configured: boolean;
  count?: number;
  rows: OsRow[];
  error?: string;
}

export default function OraclePage() {
  const { authenticated } = useAuthGuard();

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<OsResponse | null>(null);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    const res = await apiObject<OsResponse>('/api/oracle/os');
    setData(res);
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, load]);

  const rows = data?.rows ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.kod ?? '').toLowerCase().includes(q) ||
        String(r.pip ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!authenticated) return <AuthGate />;

  return (
    <PageShell
      title={t('oracle.title')}
      subtitle={t('oracle.subtitle')}
      onRefresh={load}
      isRefreshing={isRefreshing}
    >
      {loading ? (
        <SkeletonTable />
      ) : !data || data.configured === false ? (
        <NoticeCard
          title={t('oracle.notConfigured')}
          hint={data?.error || t('oracle.notConfiguredHint')}
        />
      ) : data.error ? (
        <NoticeCard danger title={t('oracle.queryError')} hint={data.error} />
      ) : rows.length === 0 ? (
        <section className="glass-panel p-6">
          <EmptyState icon={Table2} title={t('oracle.noRows')} hint={t('oracle.noRowsHint')} />
        </section>
      ) : (
        <section className="glass-panel p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-txt-primary">
                <Database className="h-4 w-4 text-accent" />
                {t('oracle.tableOs')}
              </h2>
              <p className="mt-0.5 text-2xs text-txt-muted">
                <code className="font-mono">SELECT kod, pip FROM os</code> ·{' '}
                {formatNumber(rows.length)} {t('oracle.rows')}
              </p>
            </div>

            <label className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t('oracle.searchPlaceholder')}
                aria-label={t('oracle.searchPlaceholder')}
                className="field field-sm pl-8"
              />
            </label>
          </div>

          {paginated.length === 0 ? (
            <EmptyState icon={Search} title={t('oracle.noMatches')} hint={t('oracle.noMatchesHint')} />
          ) : (
            <>
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="data-table min-w-[420px]">
                  <thead>
                    <tr>
                      <th className="w-32">{t('oracle.colKod')}</th>
                      <th>{t('oracle.colPip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r, i) => (
                      <tr key={`${r.kod}-${i}`}>
                        <td className="font-mono text-2xs text-txt-secondary">{r.kod ?? '—'}</td>
                        <td className="text-txt-primary">{r.pip ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </>
          )}
        </section>
      )}
    </PageShell>
  );
}

function NoticeCard({
  title,
  hint,
  danger,
}: {
  title: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <section className="glass-panel p-8">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            danger ? 'bg-[var(--danger-soft)] text-danger' : 'bg-accent-soft text-accent'
          }`}
        >
          {danger ? <AlertTriangle className="h-6 w-6" /> : <Database className="h-6 w-6" />}
        </span>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-txt-primary">{title}</h3>
          <p className="text-2xs text-txt-muted">{hint}</p>
        </div>
      </div>
    </section>
  );
}
