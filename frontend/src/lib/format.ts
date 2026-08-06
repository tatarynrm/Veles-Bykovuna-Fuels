/**
 * Спільні форматери. Ніколи не збирайте числові рядки руками в компонентах.
 *
 * Форматери залежать від обраної мови, тому їх не можна створювати на рівні
 * модуля: Intl застряг би на локалі, активній під час імпорту. Кеш нижче
 * тримає по одному екземпляру на мову — перемикання лишається дешевим, але
 * вже без заморожування.
 */

import { intlLocale, t } from '@/lib/i18n';

/** Валюта одна — гривня; від мови залежить лише спосіб її запису. */
const CURRENCY = 'UAH';

type Kind = 'currency' | 'number' | 'compact';

const cache = new Map<string, Intl.NumberFormat>();

function formatter(kind: Kind): Intl.NumberFormat {
  const locale = intlLocale();
  const key = `${kind}:${locale}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const created =
    kind === 'currency'
      ? new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: CURRENCY,
          maximumFractionDigits: 2,
        })
      : kind === 'compact'
        ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
        : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  cache.set(key, created);
  return created;
}

export const formatCurrency = (value?: number | null) => formatter('currency').format(value ?? 0);

export const formatNumber = (value?: number | null) => formatter('number').format(value ?? 0);

export const formatCompact = (value?: number | null) => formatter('compact').format(value ?? 0);

export const formatLiters = (value?: number | null) =>
  t('common.l', { v0: formatter('number').format(value ?? 0) });

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(intlLocale(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
};
