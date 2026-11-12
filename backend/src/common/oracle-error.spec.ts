import { oracleErrorText } from './oracle-error';

describe('oracleErrorText', () => {
  it('keeps the human text of a user-defined error that follows the ORA-20000 line', () => {
    const e = new Error(
      'ORA-20000: \nЗаповніть поле DAT таблиці BANKV\nORA-06512: at "VELDAT.P_UTILS", line 12\nORA-06512: at "VELDAT.BANKV_$$3_VELDAT", line 5',
    );
    expect(oracleErrorText(e)).toBe('ORA-20000: Заповніть поле DAT таблиці BANKV');
  });

  it('handles the text on the same line and drops only the stack', () => {
    const e = new Error('ORA-12899: value too large for column "UR_BANK_NAME"\nORA-06512: at "P_BANK", line 9');
    expect(oracleErrorText(e)).toBe('ORA-12899: value too large for column "UR_BANK_NAME"');
  });

  it('drops the "Help:" link that node-oracledb appends but keeps the trigger name from ORA-04088', () => {
    const e = new Error(
      "ORA-20000: Вкажіть фірму !\nORA-06512: at \"VELDAT.P_UTILS\", line 3\nORA-04088: error during execution of trigger 'VELDAT.BANKV_$$2_VELDAT'\nHelp: https://docs.oracle.com/error-help/db/ora-20000/",
    );
    expect(oracleErrorText(e)).toBe(
      "ORA-20000: Вкажіть фірму ! ORA-04088: error during execution of trigger 'VELDAT.BANKV_$$2_VELDAT'",
    );
  });

  it('copes with non-Error values and long texts', () => {
    expect(oracleErrorText('boom')).toBe('boom');
    expect(oracleErrorText(undefined)).toBe('Невідома помилка');
    expect(oracleErrorText(new Error('x'.repeat(1000))).length).toBe(400);
  });
});
