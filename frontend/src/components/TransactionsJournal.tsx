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
import { t } from '@/lib/i18n';

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
  is_fuel?: boolean;
  currency_code?: string;
  source_amount?: number;
}

interface TransactionsJournalProps {
  transactions: Transaction[];
}

// Базові типи OKKO (числові коди) з ключами перекладу. Типи Shell не хардкодимо:
// їх багато (пальне, мийка, паркування, збори…), тож збираємо динамічно з даних —
// кожен наявний тип отримує власний пункт фільтра.
const BASE_TYPE_FILTERS = [
  { value: 'ALL', label: 'tx.allTransactionTypes' },
  { value: '737', label: 'tx.n737FillUpFull' },
  { value: '774', label: 'tx.n774FuelDebit' },
  { value: '775', label: 'tx.n775PartialFullReversal' },
  { value: '783', label: 'tx.n783VoucherReturn' },
  { value: '787', label: 'tx.n787PartialVoucherReturn' },
];

export default function TransactionsJournal({ transactions }: TransactionsJournalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [basketTransId, setBasketTransId] = useState<string | null>(null);

  // Список типів для фільтра: базові OKKO (перекладені) + усі типи, наявні в даних
  // (переважно Shell — їхні описи вже українською й перекладу не потребують).
  const typeOptions = useMemo(() => {
    const options = BASE_TYPE_FILTERS.map((f) => ({ value: f.value, text: t(f.label) }));
    const seen = new Set(BASE_TYPE_FILTERS.map((f) => f.value));
    for (const tx of transactions) {
      const code = tx.trans_type != null ? String(tx.trans_type) : '';
      if (!code || seen.has(code)) continue;
      seen.add(code);
      options.push({ value: code, text: tx.trans_type_desc || code });
    }
    return options;
  }, [transactions]);

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
            {t('common.transactionLog')}
          </h2>
          <p className="mt-0.5 text-2xs text-txt-muted">
            {formatNumber(totalItems)} {t('tx.transactions')} {formatCurrency(totals.spend)} ·{' '}
            {formatNumber(totals.volume)} {t('unit.litre')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label={t('tx.transactionType')}
            className="field field-sm w-auto"
          >
            {typeOptions.map((f) => (
              <option key={f.value} value={f.value}>
                {f.text}
              </option>
            ))}
          </select>

          <ExportDropdown
            data={() => filtered}
            options={{
              filename: `transactions_${new Date().toISOString().slice(0, 10)}`,
              title: t('tx.refuellingTransactionLog'),
              subtitle: t('tx.stationNetworkOKKOShell', { v0: typeOptions.find((f) => f.value === typeFilter)?.text ?? typeFilter }),
              columns: [
                { label: t('tx.transactionNumber'), key: 'trans_id', type: 'string' },
                { label: t('tx.transactionDate'), key: 'trans_date', type: 'string' },
                { label: t('tx.fuelStation'), key: 'azs_name', type: 'string' },
                { label: t('tx.stationAddress'), key: 'addr_name', type: 'string' },
                { label: t('tx.cardPAN'), key: 'card_num', type: 'string' },
                { label: t('tx.clientDriver'), key: 'client_name', type: 'string' },
                { label: t('tx.fuelTypeProduct'), key: 'product_desc', type: 'string' },
                { label: t('common.volumeL'), key: 'volume', type: 'number' },
                { label: t('tx.pricePerLUAH'), key: 'price', type: 'number' },
                { label: t('tx.transactionAmountUAH'), key: 'amnt_trans', type: 'currency' },
                { label: t('tx.discountUAH'), key: 'amount_discount', type: 'currency' },
                { label: t('tx.transactionType'), key: 'trans_type_desc', type: 'string' },
              ],
            }}
            buttonText={t('common.export')}
          />
        </div>
      </div>

      {paginated.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('tx.noTransactionsFound')}
          hint={t('tx.tryWideningPeriodChanging')}
        />
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="data-table min-w-[860px]">
              <thead>
                <tr>
                  <th>{t('tx.operation')}</th>
                  <th>{t('tx.cardClient')}</th>
                  <th>{t('tx.station')}</th>
                  <th>{t('common.fuel')}</th>
                  <th className="num">{t('tx.volume')}</th>
                  <th className="num">{t('tx.price')}</th>
                  <th className="num">{t('tx.amount')}</th>
                  <th className="text-center">{t('tx.basket')}</th>
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

                      <td className="num text-txt-primary">
                        {tx.is_shell && !tx.is_fuel
                          ? '—'
                          : `${formatNumber(tx.volume)} ${t('unit.litre')}`}
                      </td>

                      <td className="num text-txt-secondary">
                        {tx.is_shell && !tx.is_fuel ? '—' : tx.price ? formatCurrency(tx.price) : '—'}
                      </td>

                      <td className="num">
                        <span
                          className={`stat text-xs ${isReturn ? 'text-danger' : 'text-txt-primary'}`}
                        >
                          {isReturn ? '−' : ''}
                          {formatCurrency(tx.amnt_trans)}
                        </span>
                        {tx.currency_code &&
                          tx.currency_code !== 'UAH' &&
                          typeof tx.source_amount === 'number' && (
                            <p className="mt-0.5 text-micro text-txt-muted">
                              {formatNumber(tx.source_amount)} {tx.currency_code}
                            </p>
                          )}
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
                          title={t('tx.viewBasketItems')}
                          aria-label={t('tx.basketForTransaction', { v0: tx.trans_id })}
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
