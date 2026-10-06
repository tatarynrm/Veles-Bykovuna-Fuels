-- Виправлення пакета VELDAT.P_API_TRUCK_PAY (Oracle 19c).
-- Дві зміни проти чинної версії:
--   1) api_dat / api_rahdat: get_date у 19c ВІДКИДАЄ ЧАС ("2026-08-27T16:10:47" → 00:00:00),
--      тож беремо CAST(get_timestamp(...) AS DATE) — перевірено, час зберігається.
--   2) прибрано r.nosyn і r.tofinzvit: цих колонок у TZ_TRANS більше немає, через що
--      тіло пакета зараз INVALID і не компілюється (PLS-00302).
-- Решта логіки не змінена.
create or replace package body P_API_TRUCK_PAY is

procedure save_transaction(p_json in clob) AS
    v_obj  JSON_OBJECT_T;
    r      tz_trans%ROWTYPE;
    v_cnt  PLS_INTEGER;
begin
    /* 1. Парсимо JSON */
    v_obj := JSON_OBJECT_T.parse(p_json);

    /* 2. Заповнюємо ROWTYPE без ручного переліку десятків колонок в SQL */
    r.api_brend          := v_obj.get_string('api_brend');
    r.api_dat            := cast(v_obj.get_timestamp('api_dat') as date);   -- дата + час
    r.api_cc             := v_obj.get_string('api_cc');
    r.api_transaction_id := v_obj.get_string('api_transaction_id');

    r.cctrans            := r.api_brend || '_' ||
                            to_char(r.api_dat, 'YYYYMMDDHH24MISS') || '_' ||
                            r.api_cc || '_' ||
                            r.api_transaction_id;

    /* Решта потрібних api_* полів */
    r.api_adresa         := v_obj.get_string('api_adresa');
    r.api_chek           := v_obj.get_string('api_chek');
    r.api_cina           := v_obj.get_number('api_cina');
    r.api_cinafull       := v_obj.get_number('api_cinafull');
    r.api_cinazn         := v_obj.get_number('api_cinazn');
    r.api_kil            := v_obj.get_number('api_kil');
    r.api_km             := v_obj.get_number('api_km');
    r.api_kraina         := v_obj.get_string('api_kraina');
    r.api_minus          := nvl(v_obj.get_number('api_minus'), 0);
    r.api_oper           := v_obj.get_string('api_oper');
    r.api_os             := v_obj.get_string('api_os');
    r.api_pal            := v_obj.get_string('api_pal');
    r.api_pdv            := v_obj.get_number('api_pdv');
    r.api_przn           := v_obj.get_number('api_przn');
    r.api_rahdat         := cast(v_obj.get_timestamp('api_rahdat') as date); -- дата + час
    r.api_rahnum         := v_obj.get_string('api_rahnum');
    r.api_station        := v_obj.get_string('api_station');
    r.api_suma           := v_obj.get_number('api_suma');
    r.api_sumafull       := v_obj.get_number('api_sumafull');
    r.api_sumazn         := v_obj.get_number('api_sumazn');
    r.api_tz             := v_obj.get_string('api_tz');
    r.api_valut          := v_obj.get_string('api_valut');

    /* Прапорці за замовчуванням */
    r.isignore  := 0;

    /* 3. Проста перевірка на наявність */
    SELECT COUNT(*) INTO v_cnt
    FROM tz_trans
    WHERE cctrans = r.cctrans;

    /* 4. Якщо немає — вставка цілого ROWTYPE в один рядок */
    if v_cnt = 0 then
        INSERT INTO tz_trans VALUES r;
    end if;

end;

end;
