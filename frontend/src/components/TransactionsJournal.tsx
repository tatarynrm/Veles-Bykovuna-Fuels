'use client';

import React, { useMemo, useState } from 'react';
import {
  Fuel,
  ShoppingBag,
  MapPin,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Tag,
  Receipt,
} from 'lucide-react';
import PaginationBar from './PaginationBar';
import BasketModal from './BasketModal';
import ExportDropdown from './ExportDropdown';
import { EmptyState } from './Skeletons';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';

interface Transaction {
  trans_id: string;
  trans_date: string;
  azs_name: string;
  addr_name: string;
  card_num: string;
  client_name: string;
  product_desc: string;
  volume: number;
  price: number;
  amnt_trans: number;
  amount_discount: number;
  trans_type?: number | string;
  trans_type_desc?: string;
  reversal?: boolean;
  is_return?: boolean;
  is_shell?: boolean;
}

interface TransactionsJournalProps {
  transactions: Transaction[];
}

const TYPE_FILTERS = [
  { value: 'ALL', label: 'Всі типи операцій' },
  { value: '737', label: '737 — Заправка до повного' },
  { value: '774', label: '774 — Списання пального' },
  { value: '775', label: '775 — Часткова / повна відміна' },
  { value: '783', label: '783 — Повернення талону' },
  { value: '787', label: '787 — Часткове повернення талону' },
  { value: 'SHELL_PURCHASE', label: 'Shell Mobility Purchase' },
];

export default function TransactionsJournal({ transactions }: TransactionsJournalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [basketTransId, setBasketTransId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      typeFilter === 'ALL'
        ? transactions
        : transactions.filter((tx) => String(tx.trans_type) === typeFilter),
    [transactions, typeFilter],
  );

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(
    () => ({
      spend: filtered.reduce((s, t) => s + (t.amnt_trans || 0), 0),
      volume: filtered.reduce((s, t) => s + (t.volume || 0), 0),
    }),
    [filtered],
  );

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-txt-primary">
            <Fuel className="h-4 w-4 text-accent" />
            Журнал транзакцій
          </h2>
          <p className="mt-0.5 text-2xs text-txt-muted">
            {formatNumber(totalItems)} операцій · {formatCurrency(totals.spend)} ·{' '}
            {formatNumber(totals.volume)} л
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Тип операції"
            className="field field-sm w-auto"
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <ExportDropdown
            data={() => filtered}
            options={{
              filename: `transactions_${new Date().toISOString().slice(0, 10)}`,
              title: 'Журнал заправок та транзакцій',
              subtitle: `Мережа АЗК: ОККО та Shell | Фільтр: ${
                TYPE_FILTERS.find((f) => f.value === typeFilter)?.label ?? typeFilter
              }`,
              columns: [
                { label: 'Номер транзакції', key: 'trans_id', type: 'string' },
                { label: 'Дата транзакції', key: 'trans_date', type: 'string' },
                { label: 'Станція АЗК', key: 'azs_name', type: 'string' },
                { label: 'Адреса АЗК', key: 'addr_name', type: 'string' },
                { label: 'Картка (PAN)', key: 'card_num', type: 'string' },
                { label: 'Клієнт / Водій', key: 'client_name', type: 'string' },
                { label: 'Тип пального / Продукт', key: 'product_desc', type: 'string' },
                { label: "Об'єм (л)", key: 'volume', type: 'number' },
                { label: 'Ціна за л (₴)', key: 'price', type: 'number' },
                { label: 'Сума операції (₴)', key: 'amnt_trans', type: 'currency' },
                { label: 'Знижка (₴)', key: 'amount_discount', type: 'currency' },
                { label: 'Тип операції', key: 'trans_type_desc', type: 'string' },
              ],
            }}
            buttonText="Експорт"
          />
        </div>
      </div>

      {paginated.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Транзакцій не знайдено"
          hint="Спробуйте розширити період або змінити тип операції. Порожній результат також можливий, якщо шлюз постачальника тимчасово недоступний."
        />
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="data-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Операція</th>
                  <th>Картка / Клієнт</th>
                  <th>Станція</th>
                  <th>Пальне</th>
                  <th className="num">Обʼєм</th>
                  <th className="num">Ціна</th>
                  <th className="num">Сума</th>
                  <th className="text-center">Кошик</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((tx) => {
                  const isReturn =
                    tx.reversal ||
                    tx.is_return ||
                    String(tx.trans_type) === '775' ||
                    String(tx.trans_type) === '783';

                  return (
                    <tr key={tx.trans_id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${
                              isReturn
                                ? 'bg-[var(--danger-soft)] text-danger'
                                : 'bg-accent-soft text-accent'
                            }`}
                          >
                            {isReturn ? (
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-2xs font-medium text-txt-primary">
                                #{tx.trans_id}
                              </span>
                              {tx.is_shell && (
                                <span className="badge badge-warn px-1.5 py-0">Shell</span>
                              )}
                            </div>
                            <p className="text-micro text-txt-muted">
                              {formatDateTime(tx.trans_date)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 shrink-0 text-txt-muted" />
                          <span className="font-mono text-2xs text-txt-primary">
                            {tx.card_num}
                          </span>
                        </div>
                        <p className="mt-0.5 max-w-[170px] truncate text-micro text-txt-muted">
                          {tx.client_name}
                        </p>
                      </td>

                      <td>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-txt-muted" />
                          <span className="max-w-[180px] truncate text-2xs text-txt-primary">
                            {tx.azs_name}
                          </span>
                        </div>
                        <p className="mt-0.5 max-w-[180px] truncate text-micro text-txt-muted">
                          {tx.addr_name}
                        </p>
                      </td>

                      <td>
                        <span className="badge badge-neutral">{tx.product_desc}</span>
                        {tx.trans_type_desc && (
                          <p className="mt-1 max-w-[150px] truncate text-micro text-txt-muted">
                            {tx.trans_type ? `${tx.trans_type} · ` : ''}
                            {tx.trans_type_desc}
                          </p>
                        )}
                      </td>

                      <td className="num text-txt-primary">{formatNumber(tx.volume)} л</td>

                      <td className="num text-txt-secondary">
                        {tx.price ? formatCurrency(tx.price) : '—'}
                      </td>

                      <td className="num">
                        <span
                          className={`stat text-xs ${isReturn ? 'text-danger' : 'text-txt-primary'}`}
                        >
                          {isReturn ? '−' : ''}
                          {formatCurrency(tx.amnt_trans)}
                        </span>
                        {tx.amount_discount > 0 && (
                          <p className="mt-0.5 flex items-center justify-end gap-1 text-micro text-accent">
                            <Tag className="h-2.5 w-2.5" />
                            {formatCurrency(tx.amount_discount)}
                          </p>
                        )}
                      </td>

                      <td className="text-center">
                        <button
                          onClick={() => setBasketTransId(tx.trans_id)}
                          className="btn-icon h-7 w-7"
                          title="Переглянути товари в кошику"
                          aria-label={`Кошик транзакції ${tx.trans_id}`}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      <BasketModal transId={basketTransId} onClose={() => setBasketTransId(null)} />
    </section>
  );
}
