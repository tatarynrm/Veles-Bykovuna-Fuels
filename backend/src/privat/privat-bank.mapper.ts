import { clipText } from '../fuel-sync/fuel-sync.mapper';
import type { PrivatTransaction } from './privat.mapper';

/**
 * ПриватБанк → параметри `VELDAT.P_BANK.AddBankV` (таблиця `BANKV`). Чисті функції без I/O —
 * покриті privat-bank.mapper.spec.ts.
 *
 * Що відомо про процедуру (її код прочитано з all_source):
 *  - дубль визначає за `upper(pBankIdnt || '_' || pBankTransId)`: наявний рядок мовчки
 *    пропускає і НЕ оновлює;
 *  - сама комітить після кожного виклику;
 *  - `dat` (дата завантаження) ставить `trunc(sysdate)`.
 *
 * Розміри колонок BANKV — у БАЙТАХ, а кирилиця в UTF-8 займає 2 байти на символ, тож текст
 * обрізається за байтами (clipText), інакше ORA-12899. Найнебезпечніше `UR_BANK_NAME`
 * (100 байт): у виписці є назви банків до 131 байта.
 */

export const PRIVAT_BANK_IDNT = 'PRIVATBANK';

/** Розміри VARCHAR2 у BANKV, байти. */
const MAX_BYTES = {
  bank_trans_id: 100,
  doc_number: 50,
  firma_edrpou: 20,
  firma_iban: 50,
  firma_mfo: 10,
  firma_name: 200,
  prizn: 1000,
  ur_bank_city: 100,
  ur_bank_name: 100,
  ur_edrpou: 20,
  ur_iban: 50,
  ur_mfo: 10,
  ur_name: 200,
  valut_idnt: 10,
} as const;

/** Аргументи `AddBankV` у тому ж порядку/іменах, що й у процедури (без `p` і з snake_case). */
export interface AddBankVParams {
  bank_idnt: string;
  bank_trans_id: string;
  /** `1` — прихід, `2` — розхід (див. dkOf). */
  dk: '1' | '2';
  /** `YYYY-MM-DDTHH:MM:SS`, місцевий (київський) час; у PL/SQL перетворюється TO_DATE-ом. */
  doc_date: string;
  doc_number: string | null;
  firma_edrpou: string | null;
  firma_iban: string | null;
  firma_mfo: string | null;
  firma_name: string | null;
  prizn: string | null;
  suma: number;
  suma_uah: number | null;
  ur_bank_city: string | null;
  ur_bank_name: string | null;
  ur_edrpou: string | null;
  ur_iban: string | null;
  ur_mfo: string | null;
  ur_name: string | null;
  valut_idnt: string | null;
}

/**
 * Напрямок для `pDk`: «1 — Дебет (прихід), 2 — Кредит (розхід)» — за ЗМІСТОМ, тобто з погляду
 * нашого обліку: **гроші прийшли → 1, гроші пішли → 2**.
 *
 * Не плутати з термінами банку: у виписці `TRANTYPE = D` («дебет рахунку клієнта») означає, що
 * гроші ПІШЛИ з нашого рахунку, а `C` — що прийшли. Тому `direction = 'credit'` (надходження)
 * дає `1`, а `'debit'` (списання) — `2`, а не навпаки, як могло б здатись з коментаря
 * «direction — debit-1/credit-2» в коді процедури.
 */
export function dkOf(direction: PrivatTransaction['direction']): '1' | '2' | null {
  if (direction === 'credit') return '1';
  if (direction === 'debit') return '2';
  return null;
}

/** Ідентифікатор транзакції для процедури: унікальний `ID` банку (не REF+REFN — він не унікальний). */
export const bankTransIdOf = (tx: PrivatTransaction): string | null => tx.bank_row_id ?? null;

/**
 * Пишемо лише ПРОВЕДЕНІ рядки (`PR_PR = r`) з усіма обов'язковими даними. Процедура не
 * оновлює записане, тож рядок, який ще «проводиться» (`p`), потрапив би до БД у проміжному
 * вигляді назавжди; сторновані (`t`) і забраковані (`n`) гроші не рухали взагалі.
 */
export function shouldSyncPrivat(tx: PrivatTransaction): boolean {
  return Boolean(
    tx.bank_row_id &&
      tx.status?.toLowerCase() === 'r' &&
      dkOf(tx.direction) &&
      tx.datetime &&
      tx.amount !== null,
  );
}

export function mapPrivatToAddBankV(tx: PrivatTransaction): AddBankVParams {
  return {
    bank_idnt: PRIVAT_BANK_IDNT,
    bank_trans_id: clipText(bankTransIdOf(tx), MAX_BYTES.bank_trans_id) as string,
    dk: dkOf(tx.direction) as '1' | '2',
    doc_date: tx.datetime as string,
    doc_number: clipText(tx.doc_number, MAX_BYTES.doc_number),
    firma_edrpou: clipText(tx.me.code, MAX_BYTES.firma_edrpou),
    firma_iban: clipText(tx.me.account, MAX_BYTES.firma_iban),
    firma_mfo: clipText(tx.me.mfo, MAX_BYTES.firma_mfo),
    firma_name: clipText(tx.me.name, MAX_BYTES.firma_name),
    prizn: clipText(tx.purpose, MAX_BYTES.prizn),
    suma: tx.amount as number,
    suma_uah: tx.amount_uah,
    ur_bank_city: clipText(tx.counterparty.bank_city, MAX_BYTES.ur_bank_city),
    ur_bank_name: clipText(tx.counterparty.bank_name, MAX_BYTES.ur_bank_name),
    // У коментарі процедури «ЄДРПОУ (counterparty.mfo)» — очевидна описка: код контрагента.
    ur_edrpou: clipText(tx.counterparty.code, MAX_BYTES.ur_edrpou),
    ur_iban: clipText(tx.counterparty.account, MAX_BYTES.ur_iban),
    ur_mfo: clipText(tx.counterparty.mfo, MAX_BYTES.ur_mfo),
    ur_name: clipText(tx.counterparty.name, MAX_BYTES.ur_name),
    valut_idnt: clipText(tx.currency, MAX_BYTES.valut_idnt),
  };
}
