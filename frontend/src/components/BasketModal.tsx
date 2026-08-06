'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Tag, PackageOpen } from 'lucide-react';
import { apiList } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { EmptyState } from './Skeletons';
import { t } from '@/lib/i18n';

interface BasketModalProps {
  transId: string | null;
  onClose: () => void;
}

interface BasketItem {
  product_id?: string;
  product_name?: string;
  product_desc?: string;
  quantity?: number;
  price?: number;
  amount?: number;
}

export default function BasketModal({ transId, onClose }: BasketModalProps) {
  const [loading, setLoading] = useState(true);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);

  useEffect(() => {
    if (!transId) return;
    setLoading(true);
    apiList<BasketItem>(`/api/transactions/basket/${transId}`)
      .then(setBasketItems)
      .finally(() => setLoading(false));
  }, [transId]);

  // Escape closes; body scroll locks while open
  useEffect(() => {
    if (!transId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [transId, onClose]);

  if (!transId) return null;

  const total = basketItems.reduce((sum, i) => sum + (i.amount ?? i.price ?? 0), 0);

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('tx.purchaseContents')}
    >
      <div
        className="glass-float animate-pop w-full max-w-lg rounded-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hairline-b flex items-start justify-between gap-3 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-field bg-accent-soft text-accent">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">{t('tx.purchaseContents')}</h3>
              <p className="font-mono text-2xs text-txt-muted">{t('tx.transaction')}{transId}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon h-8 w-8" aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 py-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 w-full rounded-field" />
            ))}
          </div>
        ) : basketItems.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={t('tx.noAdditionalItems')}
            hint={t('tx.transactionFuelOnlyNo')}
          />
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto py-4 pr-1">
            {basketItems.map((item, idx) => (
              <div
                key={idx}
                className="glass-inset flex items-center justify-between gap-3 p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Tag className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-txt-primary">
                      {item.product_name || item.product_desc || t('tx.item')}
                    </p>
                    <p className="font-mono text-micro text-txt-muted">
                      {item.product_id || '—'}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="stat text-xs text-accent">
                    {formatCurrency(item.amount ?? item.price)}
                  </p>
                  <p className="tabular text-micro text-txt-muted">
                    {item.quantity ?? 1} × {formatCurrency(item.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hairline-t flex items-center justify-between gap-3 pt-4">
          {basketItems.length > 0 ? (
            <p className="text-2xs text-txt-muted">
              {t('common.totalColon')} <span className="stat text-xs text-txt-primary">{formatCurrency(total)}</span>
            </p>
          ) : (
            <span />
          )}
          <button onClick={onClose} className="btn btn-ghost">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
