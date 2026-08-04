'use client';

import React, { useMemo, useState } from 'react';
import { MapPin, Navigation, Compass, Search } from 'lucide-react';
import PaginationBar from './PaginationBar';
import ExportDropdown from './ExportDropdown';
import { EmptyState } from './Skeletons';
import { formatNumber } from '@/lib/format';

interface Merchant {
  merchant_id: string;
  merchant_sap_id: string;
  merchant_name: string;
  merchant_address: string;
  city: string;
  region: string;
  services?: string[];
  status: string;
}

interface MerchantsGridProps {
  merchants: Merchant[];
}

export default function MerchantsGrid({ merchants }: MerchantsGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (m) =>
        m.merchant_name?.toLowerCase().includes(q) ||
        m.merchant_address?.toLowerCase().includes(q) ||
        m.merchant_id?.toLowerCase().includes(q),
    );
  }, [merchants, query]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-txt-primary">
            <Compass className="h-4 w-4 text-accent" />
            Партнерські АЗК
          </h2>
          <p className="mt-0.5 text-2xs text-txt-muted">
            {formatNumber(totalItems)} заправних комплексів з підтримкою паливних карток
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Пошук за назвою або адресою…"
              aria-label="Пошук АЗК"
              className="field field-sm w-56 pl-9"
            />
          </div>

          <ExportDropdown
            data={() => filtered}
            options={{
              filename: `merchants_${new Date().toISOString().slice(0, 10)}`,
              title: 'Партнерські АЗК',
              subtitle: 'Мережа ОККО та Shell',
              columns: [
                { label: 'ID', key: 'merchant_id', type: 'string' },
                { label: 'SAP ID', key: 'merchant_sap_id', type: 'string' },
                { label: 'Назва', key: 'merchant_name', type: 'string' },
                { label: 'Адреса', key: 'merchant_address', type: 'string' },
                { label: 'Регіон', key: 'region', type: 'string' },
                { label: 'Статус', key: 'status', type: 'string' },
              ],
            }}
            buttonText="Експорт"
          />
        </div>
      </div>

      {paginated.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Комплексів не знайдено"
          hint={
            query
              ? `За запитом «${query}» нічого не знайдено.`
              : 'Шлюз постачальника не повернув перелік АЗК.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginated.map((m, i) => (
              <article
                key={m.merchant_id}
                className="glass-inset glass-inset-hover rise flex flex-col justify-between p-4 transition-colors"
                style={{ '--d': `${Math.min(i, 8) * 35}ms` } as React.CSSProperties}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-micro text-txt-muted">#{m.merchant_id}</span>
                    <span className="badge badge-success">
                      <span className="badge-dot" />
                      Відкрито
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-medium leading-snug text-txt-primary">
                    {m.merchant_name}
                  </h3>

                  <p className="mt-1.5 flex items-start gap-1.5 text-2xs text-txt-muted">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    <span className="leading-snug">{m.merchant_address}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(m.services ?? []).slice(0, 4).map((srv, idx) => (
                      <span key={idx} className="badge badge-neutral">
                        {srv}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="hairline-t mt-4 flex items-center justify-between pt-3">
                  <span className="font-mono text-micro text-txt-muted">
                    SAP #{m.merchant_sap_id}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      `${m.merchant_name} ${m.merchant_address}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost px-2.5 py-1.5 text-micro"
                  >
                    <Navigation className="h-3 w-3" />
                    Мапа
                  </a>
                </div>
              </article>
            ))}
          </div>

          <PaginationBar
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </>
      )}
    </section>
  );
}
