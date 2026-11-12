/**
 * Читабельний текст помилки Oracle для статусу й логів.
 *
 * Користувацька помилка (`raise_application_error` / `p_utils.runerror` у тригері) приходить як
 *
 *   ORA-20000: <текст для людини>
 *   ORA-06512: at "VELDAT.P_UTILS", line 12
 *   ORA-06512: at "VELDAT.BANKV_$$2_VELDAT", line 40
 *
 * Брати лише перший рядок означало б загубити сам текст, а він і є причиною. Рядки стеку
 * (`ORA-06512`) нічого не додають, тому відкидаються; решта зклеюється в один рядок.
 */
export function oracleErrorText(error: unknown, maxLength = 400): string {
  const raw = String((error as any)?.message ?? error ?? 'Невідома помилка');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^ORA-06512\b/.test(line) && !/^Help:/i.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}
