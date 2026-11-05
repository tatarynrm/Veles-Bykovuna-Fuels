'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { PrivatCardTransactionsResult, PrivatCardsResult } from '@/shared/contracts';

export interface CardTxRequest {
  /** ISO YYYY-MM-DD. */
  from: string;
  to: string;
  /** Лише одна картка — її pan_key. */
  card?: string;
}

/**
 * Картковий API Приват24. Список карток швидкий і вантажиться сам; операції — окремий,
 * повільний запит (банк відповідає десятки секунд), тож їх запускають явно кнопкою.
 * Помилка виписки не чіпає список карток — вони з різних запитів.
 */
export function usePrivatCards(enabled: boolean) {
  const [cards, setCards] = useState<PrivatCardsResult | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const [tx, setTx] = useState<PrivatCardTransactionsResult | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const txSeq = useRef(0);

  const loadCards = useCallback(async (force = false) => {
    setCardsLoading(true);
    setCardsError(null);
    try {
      setCards(await apiGet<PrivatCardsResult>('/api/privat/cards', { state: 'all', force: force ? 1 : undefined }));
    } catch (e: any) {
      setCards(null);
      setCardsError(e?.message ?? 'Не вдалося отримати список карток');
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (req: CardTxRequest, force = false) => {
    const mine = ++txSeq.current;
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await apiGet<PrivatCardTransactionsResult>('/api/privat/card-transactions', {
        startDate: req.from,
        endDate: req.to,
        card: req.card,
        force: force ? 1 : undefined,
      });
      if (mine === txSeq.current) setTx(res);
    } catch (e: any) {
      if (mine !== txSeq.current) return;
      setTx(null);
      setTxError(e?.message ?? 'Не вдалося отримати операції по картках');
    } finally {
      if (mine === txSeq.current) setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void loadCards();
    return () => {
      txSeq.current += 1;
    };
  }, [enabled, loadCards]);

  return { cards, cardsLoading, cardsError, loadCards, tx, txLoading, txError, loadTransactions };
}
