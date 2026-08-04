'use client';

import React, { useState } from 'react';
import { CreditCard, FileText, ShieldCheck, Tag, WalletCards } from 'lucide-react';
import PaginationBar from './PaginationBar';
import ExportDropdown from './ExportDropdown';
import { EmptyState } from './Skeletons';
import { formatCurrency, formatNumber } from '@/lib/format';

interface CardLimit {
  limit_id: string;
  limit_desc: string;
  limit_value: number;
  limit_remains: number;
  limit_used: number;
  cycle_type_desc: string;
}

interface Card {
  card_num: string;
  contract_id: string;
  status: string;
  status_desc: string;
  card_owner_f_name?: string;
  card_owner_l_name?: string;
  exp_date?: string;
  product_name?: string;
  limits?: CardLimit[];
  is_shell?: boolean;
}

interface Contract {
  contract_id: string;
  contract_number: string;
  contract_name: string;
  client_name: string;
  contract_type: string;
  contract_status: string;
  balance: number;
  credit_limit: number;
  currency: string;
}

interface CardsTableProps {
  cards: Card[];
  contracts: Contract[];
}

export default function CardsTable({ cards, contracts }: CardsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = cards.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const page = Math.min(currentPage, totalPages);
  const paginated = cards.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5">
      {/* ── Contracts ── */}
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-txt-primary">
              <FileText className="h-4 w-4 text-accent" />
              Договори компанії
            </h2>
            <p className="mt-0.5 text-2xs text-txt-muted">
              ТОВ «Велес Буковина» · {formatNumber(contracts.length)} активних
            </p>
          </div>

          <ExportDropdown
            data={() => contracts}
            options={{
              filename: `contracts_${new Date().toISOString().slice(0, 10)}`,
              title: 'Активні договори компанії',
              subtitle: 'ТОВ «Велес Буковина»',
              columns: [
                { label: 'ID Договору', key: 'contract_id', type: 'string' },
                { label: 'Номер договору', key: 'contract_number', type: 'string' },
                { label: 'Назва договору', key: 'contract_name', type: 'string' },
                { label: 'Клієнт', key: 'client_name', type: 'string' },
                { label: 'Тип договору', key: 'contract_type', type: 'string' },
                { label: 'Статус договору', key: 'contract_status', type: 'string' },
                { label: 'Поточний баланс (₴)', key: 'balance', type: 'currency' },
                { label: 'Кредитний ліміт (₴)', key: 'credit_limit', type: 'currency' },
                { label: 'Валюта', key: 'currency', type: 'string' },
              ],
            }}
            buttonText="Експорт"
          />
        </div>

        {contracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Договорів не знайдено"
            hint="Шлюз OKKO не повернув жодного договору за поточними обліковими даними."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contracts.map((c, i) => (
              <article
                key={c.contract_id}
                className="glass-inset glass-inset-hover rise flex flex-col justify-between p-4 transition-colors"
                style={{ '--d': `${i * 40}ms` } as React.CSSProperties}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-micro text-txt-muted">#{c.contract_id}</span>
                    <span className="badge badge-success">
                      <span className="badge-dot" />
                      {c.contract_status || 'ACTIVE'}
                    </span>
                  </div>

                  <h3 className="mt-2 truncate text-sm font-medium text-txt-primary">
                    {c.contract_name}
                  </h3>
                  <p className="truncate text-2xs text-txt-muted">{c.client_name}</p>

                  <div className="mt-3 flex items-start gap-1.5">
                    <Tag className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    <span className="text-micro text-txt-secondary">
                      Схема знижок: всі дп 4 · бенз 4 · спбт 1
                    </span>
                  </div>
                </div>

                <div className="hairline-t mt-4 flex items-end justify-between pt-3">
                  <div>
                    <p className="micro-label">Баланс</p>
                    <p className="stat mt-0.5 text-lg">{formatCurrency(c.balance)}</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-accent/40" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Cards ── */}
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-txt-primary">
              <CreditCard className="h-4 w-4 text-accent" />
              Реєстр паливних карток
            </h2>
            <p className="mt-0.5 text-2xs text-txt-muted">
              {formatNumber(totalItems)} карток OKKO Smart Card та Shell Mobility
            </p>
          </div>

          <ExportDropdown
            data={() =>
              cards.map((c) => {
                const limit = c.limits?.[0];
                return {
                  ...c,
                  owner_name: `${c.card_owner_f_name || 'Водій'} ${c.card_owner_l_name || ''}`.trim(),
                  network_name: c.is_shell ? 'Shell Mobility' : 'OKKO Smart Card',
                  limit_val: limit?.limit_value ?? 0,
                  limit_rem: limit?.limit_remains ?? 0,
                  limit_cycle: limit?.cycle_type_desc ?? 'доба',
                };
              })
            }
            options={{
              filename: `fuel_cards_${new Date().toISOString().slice(0, 10)}`,
              title: 'Реєстр паливних карток',
              subtitle: 'ТОВ «Велес Буковина»',
              columns: [
                { label: 'Номер картки (PAN)', key: 'card_num', type: 'string' },
                { label: 'ID Договору', key: 'contract_id', type: 'string' },
                { label: 'Водій / Власник', key: 'owner_name', type: 'string' },
                { label: 'Мережа АЗК', key: 'network_name', type: 'string' },
                { label: 'Термін дії', key: 'exp_date', type: 'string' },
                { label: 'Добовий ліміт (₴)', key: 'limit_val', type: 'currency' },
                { label: 'Залишок ліміту (₴)', key: 'limit_rem', type: 'currency' },
                { label: 'Цикл ліміту', key: 'limit_cycle', type: 'string' },
                { label: 'Статус картки', key: 'status_desc', type: 'string' },
              ],
            }}
            buttonText="Експорт"
          />
        </div>

        {paginated.length === 0 ? (
          <EmptyState
            icon={WalletCards}
            title="Карток не знайдено"
            hint="За обраною мережею немає активних карток, або шлюз постачальника не відповів."
          />
        ) : (
          <>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th>Картка</th>
                    <th>Власник</th>
                    <th>Мережа</th>
                    <th>Термін дії</th>
                    <th className="num">Ліміт</th>
                    <th className="num">Залишок</th>
                    <th className="text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => {
                    const limit = c.limits?.[0];
                    const isActive = c.status === 'ACTV' || c.status === 'CHST5';
                    const used =
                      limit && limit.limit_value > 0
                        ? Math.min(100, Math.round((limit.limit_used / limit.limit_value) * 100))
                        : 0;

                    return (
                      <tr key={c.card_num}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-2xs font-medium text-txt-primary">
                              {c.card_num}
                            </span>
                            {c.is_shell && (
                              <span className="badge badge-warn px-1.5 py-0">Shell</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-micro text-txt-muted">
                            Договір #{c.contract_id}
                          </p>
                        </td>

                        <td className="text-2xs text-txt-primary">
                          {`${c.card_owner_f_name || 'Водій'} ${c.card_owner_l_name || ''}`.trim()}
                        </td>

                        <td>
                          <span className="badge badge-neutral">
                            {c.product_name || 'OKKO Smart Card'}
                          </span>
                        </td>

                        <td className="tabular text-2xs text-txt-secondary">
                          {c.exp_date || '—'}
                        </td>

                        <td className="num text-txt-secondary">
                          {limit ? (
                            <>
                              <span className="text-txt-primary">
                                {formatCurrency(limit.limit_value)}
                              </span>
                              <p className="text-micro text-txt-muted">
                                / {limit.cycle_type_desc}
                              </p>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="num">
                          {limit ? (
                            <>
                              <span className="stat text-xs text-accent">
                                {formatCurrency(limit.limit_remains)}
                              </span>
                              <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-surface-hover">
                                <div
                                  className="h-full rounded-full bg-accent"
                                  style={{ width: `${100 - used}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="text-center">
                          <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                            <span className="badge-dot" />
                            {isActive ? 'Активна' : 'Блокована'}
                          </span>
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
      </section>
    </div>
  );
}
