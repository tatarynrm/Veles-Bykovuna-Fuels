'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import type {
  PrivatBalance,
  PrivatList,
  PrivatScope,
  PrivatTransactionsResult,
} from '@/shared/contracts';

export interface PrivatRequest {
  scope: PrivatScope;
  /** ISO YYYY-MM-DD; used by the `period` scope only. */
  from: string;
  to: string;
}

/**
 * Виписка Приват24: операції за період + залишки по рахунках.
 *
 * Банк віддає ~1 запит/с, тож великий період вантажиться десятки секунд. Два запити
 * (операції та залишки) ідуть паралельно з браузера, але на бекенді стоять в одній
 * черзі — ліміт вендора не порушується. Відповідь на застарілий запит ігнорується.
 */
export function usePrivatStatements(enabled: boolean) {
  const [transactions, setTransactions] = useState<PrivatTransactionsResult | null>(null);
  const [balances, setBalances] = useState<PrivatList<PrivatBalance> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (req: PrivatRequest, force = false) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(null);
      setBalanceError(null);

      const params = {
        scope: req.scope,
        startDate: req.scope === 'period' ? req.from : undefined,
        endDate: req.scope === 'period' ? req.to : undefined,
        force: force ? 1 : undefined,
      };

      const [tx, bal] = await Promise.allSettled([
        apiGet<PrivatTransactionsResult>('/api/privat/transactions', params),
        // Залишки не залежать від періоду: «поточний» стан = останній фінальний день.
        apiGet<PrivatList<PrivatBalance>>('/api/privat/balances', {
          scope: 'final',
          force: force ? 1 : undefined,
        }),
      ]);
      if (mine !== seq.current) return;

      if (tx.status === 'fulfilled') setTransactions(tx.value);
      else {
        setTransactions(null);
        setError(tx.reason?.message ?? 'Не вдалося отримати виписку');
      }
      if (bal.status === 'fulfilled') setBalances(bal.value);
      else {
        setBalances(null);
        setBalanceError(bal.reason?.message ?? 'Не вдалося отримати залишки');
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    // Скасувати відповіді, що ще летять, коли сторінку закрили.
    return () => {
      seq.current += 1;
    };
  }, [enabled]);

  return { transactions, balances, loading, error, balanceError, load };
}
