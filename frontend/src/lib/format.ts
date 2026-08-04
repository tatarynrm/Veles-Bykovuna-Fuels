/** Shared Ukrainian-locale formatters. Never hand-roll number strings in components. */

const uah = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('uk-UA', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatCurrency = (value?: number | null) => uah.format(value ?? 0);

export const formatNumber = (value?: number | null) => num.format(value ?? 0);

export const formatCompact = (value?: number | null) => compact.format(value ?? 0);

export const formatLiters = (value?: number | null) => `${num.format(value ?? 0)} л`;

export const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('uk-UA', {
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
    : d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
};
