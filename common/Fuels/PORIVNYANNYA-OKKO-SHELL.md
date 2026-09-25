# Транзакції OKKO vs Shell — які дані віддає кожен вендор

> Порівняння **сирих** відповідей API транзакцій — рівно те, що приходить від вендора, без
> маперів бекенду. Усе нижче перевірено на реальних відповідях, а не лише за документацією:
> OKKO — уся історія (838 транзакцій, 03.2022–09.2026), Shell — дані за 01–09.2026.
> Відсотки заповненості Shell порахувано за останній місяць (585 рядків). Стан на 15.09.2026.

## Файли з даними — останній місяць

| Файл | Вендор | Період | Рядків |
|---|---|---|---|
| [`data/okko-transactions_2026-08-15_2026-09-15.json`](data/okko-transactions_2026-08-15_2026-09-15.json) | OKKO | 15.08–15.09.2026 | **1** — за цей місяць карткою OKKO заправлялись один раз (для порівняння: 18.07–16.08 — 108) |
| [`data/shell-transactions_2026-08-15_2026-09-15.json`](data/shell-transactions_2026-08-15_2026-09-15.json) | Shell | 15.08–15.09.2026 | **585** = 334 продажі + 251 збір |

Формат файлу: `{ "meta": {…}, "transactions": […] }`. У `transactions` — рядки рівно як від API
(OKKO: копійки й мілілітри; Shell: дати `yyyyMMdd`). Єдиний виняток — Shell `SalesItemId`
записано **рядком**: це 64-бітне число, яке звичайний `JSON.parse` округлює (див. §6).

Вивантажити за інший період:

```bash
node common/Fuels/download-transactions.js all 2026-07-15 2026-08-15
```

> ⚠️ У файлах повні номери карток — тека `data/` виключена з git.

---

## 1. Коротко: чим відрізняються

| | OKKO | Shell |
|---|---|---|
| Запит | `GET /api/erp/v2/transactions` | `POST /fleetmanagement/v1/transaction/pricedtransactions` |
| Обгортка відповіді | `{ total, items: […] }` (у Swagger помилково `transactions`) | `{ Transactions: […], RowCount, TotalPages, CurrentPage, Error, RequestId }` |
| Полів у рядку | 30; якщо даних немає — **ключ відсутній** | 128; ключі є завжди, порожнє = `""` або `null` |
| Що потрапляє | заправки + операції з договором (поповнення, списання) | продажі `SalesItem` (пальне, AdBlue, тол) + збори `FeeItem` (комісії, оренда OBU, пеня) |
| Країна операцій | Україна | Болгарія, Туреччина, Угорщина, Словенія, Румунія |
| Валюта | лише UAH | валюта транзакції (EUR, PLN, TRY, HUF, RON) + валюта інвойсу EUR |
| Гроші | **копійки**, цілі числа | десяткові (`184.28`) |
| Обʼєм | **мілілітри** (`40000` = 40 л) | літри (`101.03`) |
| Ціна за одиницю | ціна АЗС до знижки | ціна клієнта **без ПДВ**, уже зі знижкою |
| ПДВ | немає | ставка, сума, суми без і з ПДВ |
| Знак знижки | «+» = знижка, «−» = націнка | «−» = знижка |
| Дата й час | одне поле `2026-08-27T16:10:47.000` | `20260827` + `08:59:36` + `+03:00:00` окремими полями |
| Держномер ТЗ | немає | `VehicleRegistration` |
| ПІБ водія | немає (є лише мітка картки) | немає (у `DriverName` — держномер) |
| Інвойс | немає | номер, дата, статус |
| Тип операції | числовий код `trans_type` | `Type` + код і група товару |
| Унікальний ID рядка | `trans_id` | `SalesItemId` / `TrnIdentifier` |
| Пагінація | `size` + `offset` (= **номер сторінки**) | `PageSize` + `CurrentPage` |
| Макс. період одного запиту | 31 день | 210 днів |
| Рядків за календарний місяць (2026) | від 2 до 80 | ~600–800 |

---

## 2. Порівняльна таблиця: де які дані

`—` означає, що вендор таких даних не віддає.

### 2.1. Ідентифікатори

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| ID транзакції | `trans_id` — `"270247608"` | `TransactionId` — `"48F16F61C260827D626"` | У Shell лише в продажах; одна покупка може мати кілька рядків з тим самим `TransactionId` (дизель + AdBlue) |
| Унікальний ID рядка | `trans_id` (1 транзакція = 1 рядок) | `SalesItemId` — `4611686018933871270`; `TrnIdentifier` — `"374611686018933871270"` | `TrnIdentifier` = «37» + `SalesItemId`, рядок, є і в зборах |
| № рядка в покупці | — | `TransactionLine` — `"1"`, `"2"` | |
| RRN платіжної операції | `rrn` — `"000270247608"` | — | У поверненні `775` поле `rrn` = `trans_id` початкової заправки `774` тією ж карткою — так їх звʼязати (якщо `rrn` заповнене) |
| Код авторизації | `approval_code` — `"247608"` | `AuthorisationCode` — `"793172"` | У Shell — лише пальне й AdBlue |
| № чека | — | `ReceiptNumber` — `"146558"` | У зборах = `SalesItemId` |
| Ідентифікатор толу | — | `Additional1` — `"2026-0000000039558956"` | Лише рядки толу (Road tax) |

### 2.2. Дата і час

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Дата й час операції | `trans_date` — `"2026-08-27T16:10:47.000"` | `TransactionDate` — `"20260827"` + `TransactionTime` — `"08:59:36"` | OKKO — ISO без часового поясу; Shell — місцевий час країни операції |
| Зсув від UTC | — | `UTCOffset` — `"+03:00:00"` | Лише продажі |
| Дата проведення | — | `PostingDate` — `"20260827 09:49:14"` | |
| Дата інвойсу | — | `InvoiceDate` — `"20260831 00:00:00"` | `null`, поки не виставлено |

### 2.3. Картка, транспорт, водій

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Номер картки | `card_num` — 16 цифр, `782539••••••0235` | `CardPAN` — 19 цифр, `707742•••••••••0442` | Обидва віддають **повний** номер (тут замасковано) |
| ID картки у вендора | — | `CardId` — `883304` | |
| Термін дії картки | — | `CardExpiry` — `"20270630"`, `CardExpiryPeriod` — `"2706"` | |
| Тип картки / носія | — | `CardType` — `"UA CRT INT MUL R7"` (паливна) / `"UA CRT INT TMF ETOLL"` (толова); `TokenTypeDescription` | |
| Частини номера картки | — | `IssuerCode` `"7077"`, `ReleaseCode`, `CardSequenceNumber`, `CheckDigit` | Вирізані з `CardPAN` |
| Держномер ТЗ | — | `VehicleRegistration` — `"CE5465BM"` | Надрукований на картці |
| Водій | `person_first_name` + `person_last_name` — `"Default"` + `"SKODA"` / `"4495"` | `DriverName` — `"CE4067EE"` | **ПІБ немає ніде**: в OKKO це мітка картки (марка авто або цифри номера), у Shell — держномер |
| Введено водієм на АЗС | — | `FleetIdInput` — `"CE5465BM "`, `OdometerInput` — `0` | Пробіг майже завжди `0` або `null` |
| Чи вводився PIN | — | `PINIndicator` — `"PIN Used"` / `"No PIN"` | |

### 2.4. АЗС і місце

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Код АЗС | `ext_azs` — `"40563200"` | `SiteCode` — `"5012"`, `"T4BG"` | `T4BG` — віртуальна «станція» толу Болгарії (Toll4Europe) |
| Назва АЗС | `azs_name` — `"АЗС 028 Франківськ ОККО-Драйв"` | `SiteName` — `"5012 SHELL RUSSE DANUBE BRIDGE"` | |
| Адреса | `addr_name` — `"Чернівецька, Чернівці, Калинівська, 1-А"` | — | |
| Координати | — | `Location` — `{ "Latitude": "43.876", "Longitude": "26.018" }` | Рядками; лише АЗС Shell (~9 % рядків) |
| Країна | — (завжди Україна) | `PurchasedInCountryCode` — `"BG"`; `PurchasedInCountry`, `SiteCountry` — `"Bulgaria"` | |
| Мережа і продавець | — | `Network`, `NetworkCode`, `SiteGroupId`/`SiteGroupName`, `IsShellSite`, `DelcoName` — `"Shell Bulgaria EAD"`, `DelcoCode` | |
| Термінал | `org_device` — `"T0C2802"` | — | `"RPL001"` — поповнення договору |

### 2.5. Товар

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Код товару | `product_id` — `"9009"` (SAP) | `ProductCode` — `"30"` | Довідники різні: §3.2 і §4.2 |
| Назва | `product_desc` — `"Бензин А-95"` | `ProductName` — `"Diesel AGO"` | OKKO — українською, Shell — англійською |
| Група товару | — | `ProductGroupId` — `7` + `ProductGroupName` — `"Automotive Gas Oil"` | |
| Пальне чи ні | є `product_id` → пальне | `FuelProduct` — `true` | |
| Непаливні товари | `basket_of_goods` — `false` (завжди) | окремими рядками | |

### 2.6. Кількість і ціна

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Кількість | `volume` — `40000` = **40 л** (мілілітри) | `Quantity` — `101.03` (літри) | Shell: у толі `Quantity = 1`, у зборах — **база нарахування** комісії, не літри |
| Ціна на стелі | `price` — `8290` = 82,90 грн/л (копійки) | `DelcoRetailPriceUnitGross` — `1.88` (з ПДВ), `DelcoRetailPriceUnitNet` — `1.5667`; в EUR — `CustomerRetailPriceUnitGross` | |
| Ціна для клієнта | окремого поля немає: `price − price_discount` | `UnitPriceInTransactionCurrency` — `1.52`, `UnitPriceInInvoiceCurrency` — `1.52` | Shell — **без ПДВ** і вже зі знижкою: `Quantity × UnitPrice = TransactionNetAmount` |
| Прайсова ціна | — | `DelcoListPriceUnitNet` — `1.617` | Заповнена лише при `DiscountType = "65"` |
| Знижка на одиницю | `price_discount` — `400` = 4,00 грн/л | `UnitDiscountTransactionCurrency` — `-0.097` (без ПДВ); `UnitDiscountInvoiceCurrency` — `-0.1164` (з ПДВ, EUR); `EffectiveUnitDiscountInCustomerCurrency` | Знаки протилежні: OKKO «+» = знижка, Shell «−» = знижка |

### 2.7. Суми, знижка, ПДВ

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Сума за ціною стели | `amnt_trans` — `331600` = 3 316,00 грн | `DelcoRetailValueTotalGross` — `189.94`, `DelcoRetailValueTotalNet` — `158.28`; в EUR — `CustomerRetailValueTotal…` | OKKO: `price × volume / 1000` |
| Сума знижки | `amount_discount` — `16000` = 160,00 грн | `EffectiveDiscountInTrxCurrency` — `-9.8`, `EffectiveDiscountInCustomerCurrency` | OKKO: `price_discount × volume / 1000`; Shell: `UnitDiscount × Quantity` |
| **Сума до сплати** | `amnt_acct` — `315600` = 3 156,00 грн | `TransactionGrossAmount` — `184.28` (валюта транзакції); `InvoiceGrossAmount` — `184.28` (EUR, як у рахунку) | OKKO: `amnt_acct = amnt_trans − amount_discount` |
| Сума без ПДВ | — | `TransactionNetAmount` — `153.57`, `InvoiceNetAmount`, `NetEuroAmount` | |
| Сума ПДВ | — | `TransactionTax` — `30.71` (= `VATonNetAmount`); `InvoiceTax` (= `VATonNetAmountInCustomerCurrency` = `EuroVATAmount`) | `Gross = Net + Tax` у 100 % рядків |
| Ставка ПДВ | — | `VATRate` — `0.2`, `VATApplicable` — `"Y"`, `VATCategory`, `VATCountry` | У толі та зборах ставка 0 |
| Знижка у відсотках | — | `RebateRate` — `-7.66` | |
| Баланс договору | `available_balance` — `18773389` = 187 733,89 грн | — | Баланс **до** операції |

### 2.8. Валюта і курс

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Валюта транзакції | `acurr_trans` — `"UAH"` | `TransactionCurrencyCode` — `"EUR"`, `"PLN"`, `"TRY"`, `"HUF"`, `"RON"` (+ `…Symbol`) | Збори Shell — завжди PLN |
| Валюта рахунку | `acurr_acct` — `"UAH"` | `InvoiceCurrencyCode` = `CustomerCurrencyCode` — `"EUR"` (+ `…Symbol`) | |
| Курс | — | `DelCoExchangeRate` = `DelCoToColCoExchangeRate` — `1`; `ColCoExchangeRate` — завжди `1` | Одиниць валюти транзакції за 1 EUR (TRY ≈ 51, HUF ≈ 355). У зборах `null` |
| Валюта від мережі | — | `IncomingCurrencyCode` — `"EUR"` | |

### 2.9. Тип операції

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Тип | `trans_type` — `774` (словник §3.1) | `Type` — `"SalesItem"` / `"FeeItem"`; `TransactionType` — `"Purchase"`, `TransactionTypeDescription` — `"1-Purchase"` | У Shell суть операції видно з коду й групи товару (§4.2) |
| Повернення / сторно | `reversal` — `false` (завжди); коди `775`, `783`, `787` | `CreditDebitCode` — `"D"` / `"C"`, `RefundFlag` — `"N"`, `OriginalSalesItemId`, `CorrectionFlag` | |
| Знак суми | суми **завжди додатні**; напрям видно лише з `trans_type` | від'ємні суми бувають (коригування), тоді `CreditDebitCode = "C"` | |
| Спір, клірінг | — | `DisputeStatus` — `"No Dispute"`, `CRMNumber`, `AllowClearing` — `"Y"` | |
| Як рахується знижка | — | `DiscountType` — `"65"` (від прайсу) / `"66"` (від стели) | У документації Shell коди 1/2/3 — не збігаються |

### 2.10. Клієнт, договір, інвойс

| Дані | OKKO | Shell | Коментар |
|---|---|---|---|
| Клієнт | `client_id` — `"0600036165"`, `client_name` | `PayerNumber` — `"PL60039295"`, `PayerName`, `AccountId` — `19511`, `AccountNumber`, `AccountName`, `AccountShortName`, `CustomerCountry`, `CustomerCountryCode` | |
| Договір | `contract_id` — `"0010029571"`, `contract_name` — `"27ПК-40868/23"` | — | В OKKO два договори: `0010029571` і `1000112062` |
| Інвойс | — | `InvoiceNumber` — `"1500799260"`, `InvoiceDate`, `IsInvoiced` — `true`, `TransactionStatus` — `"I"` / `"U"` | |
| Стан обробки | `processed_in_bo` — `1` | — | Число, а не boolean |

---

## 3. OKKO — усі поля (30)

Запит: `GET https://gw-online.okko.ua:9443/api/erp/v2/transactions?date_from=…&date_to=…&processed_in_bo=…&size=…&offset=…`,
заголовок `X-API-KEY`. Відповідь: `{ "total": 1, "items": [ … ] }`.
Приклади — з єдиної транзакції останнього місяця (27.08.2026, А-95, 40 л).

| Поле | Тип | Приклад | Що означає | Коли ключа немає |
|---|---|---|---|---|
| `trans_id` | рядок | `"270247608"` | ID транзакції в OKKO, 9 цифр, унікальний | є завжди |
| `amnt_trans` | ціле | `331600` | Сума за ціною АЗС **до знижки**, копійки (3 316,00 грн) = `price × volume / 1000` | є завжди |
| `card_num` | рядок | `782539••••••0235` | Номер паливної картки, 16 цифр, повний | операції з договором (687, 688) |
| `trans_date` | рядок | `"2026-08-27T16:10:47.000"` | Дата й час операції, ISO без часового поясу; у поповненнях часто `00:00:00` | є завжди |
| `contract_id` | рядок | `"0010029571"` | Номер договору | є завжди |
| `contract_name` | рядок | `"27ПК-40868/23"` | Назва договору | є завжди |
| `acurr_acct` | рядок | `"UAH"` | Валюта рахунку договору | є завжди |
| `acurr_trans` | рядок | `"UAH"` | Валюта транзакції | є завжди |
| `org_device` | рядок | `"T0C2802"` | Термінал, що провів операцію; `"RPL001"` — поповнення. У Swagger помилково число | є завжди |
| `trans_type` | число | `774` | Тип операції, словник §3.1 | є завжди |
| `client_id` | рядок | `"0600036165"` | ID клієнта | є завжди |
| `client_name` | рядок | `"ТОВ \"Велес Буковина\""` | Назва клієнта | є завжди |
| `reversal` | boolean | `false` | Ознака сторно; за всю історію лише `false` | є завжди |
| `amnt_acct` | ціле | `315600` | **Фактично списано з договору**, копійки (3 156,00 грн) = `amnt_trans − amount_discount` | є завжди |
| `amount_discount` | ціле | `16000` | Сума знижки, копійки (160,00 грн); від'ємна = націнка | є завжди |
| `azs_name` | рядок | `"АЗС 028 Франківськ ОККО-Драйв"` | Назва АЗС | 687, 688 |
| `ext_azs` | рядок | `"40563200"` | Код АЗС, 8 цифр (у Swagger поля немає) | 687, 688; зрідка й у заправці |
| `addr_name` | рядок | `"Чернівецька, Чернівці, Калинівська, 1-А"` | Адреса АЗС | 687, 688 |
| `available_balance` | ціле | `18773389` | Доступний баланс договору **до** операції, копійки (187 733,89 грн) | є завжди |
| `processed_in_bo` | число | `1` | `1` — оброблено в бек-офісі OKKO. Число, а не boolean | є завжди |
| `volume` | ціле | `40000` | Кількість, **мілілітри** (40 л); `0` в операціях з договором | є завжди |
| `price` | ціле | `8290` | Ціна АЗС за 1 л до знижки, копійки (82,90 грн); `0` в операціях з договором | є завжди |
| `product_id` | рядок | `"9009"` | SAP-код пального, словник §3.2 | 687, 688 |
| `product_desc` | рядок | `"Бензин А-95"` | Назва пального | 687, 688 |
| `basket_of_goods` | boolean | `false` | Чи є непаливні товари; за всю історію лише `false` | є завжди |
| `person_first_name` | рядок | `"Default"` | «Імʼя» власника картки — фактично `Default` / `Новий` / `ТК` | 687, 688 |
| `person_last_name` | рядок | `"SKODA"` | Мітка картки: марка авто або цифри держномера (`"4495"`), **не прізвище** | 687, 688 |
| `price_discount` | ціле | `400` | Знижка на 1 л, копійки (4,00 грн); від'ємна = націнка | є завжди |
| `rrn` | рядок | `"000270247608"` | RRN — референс платіжної операції, 12 цифр | більшість транзакцій 2022 року |
| `approval_code` | рядок | `"247608"` | Код авторизації, 6 цифр | як і `rrn` |

> «Ключа немає» — поле **відсутнє в JSON взагалі**, а не `null`. За історію трапляються
> 5 різних наборів полів (від 20 до 30 ключів).

### 3.1. Типи операцій `trans_type`

Офіційний словник OKKO: `GET /v2/metadata`, записи з `KEY = "TPTP"`.

| Код | Назва OKKO | Разів за всю історію |
|---|---|---|
| `774` | Заправка/покупка з карткою (Purchase POS) | 542 |
| `737` | Заправка «до повного» (Purchase completion POS) | 159 |
| `687` | Поповнення контракту (Credit Account) | 74 — без картки й АЗС, 10 000–1 000 000 грн |
| `775` | Часткове повернення (Return or refund POS) | 62 — повертає невикористану частину заправки `774` (звʼязок через `rrn`) |
| `688` | Списання з контракту (Debit Account) | 1 |
| `736` | Попередня авторизація заправки «до повного» | — |
| `780` | Заправка по талону | — |
| `783` | Повернення талона | — |
| `787` | Часткове повернення талона | — |
| `706`, `781` | Переказ з контракту | — |
| `785` | Зарахування на контракт | — |
| `659` | Дебетовий договір з предʼявленням | — |
| `550` | Зміна PIN-коду | — |

### 3.2. Коди пального `product_id`

Словник `/v2/metadata`, `KEY = "DL09"`.

| Код | Пальне | Разів за всю історію |
|---|---|---|
| `9018` | Дизельне паливо | 682 |
| `9009` | Бензин А-95 | 71 |
| `22242` | Бензин Pulls 95 | 6 |
| `45290` | Паливо дизельне Pulls Diesel | 4 |
| `119620` | Бензин Pulls 100 | — |
| `9439` | Зріджений газ (СПБТ) | — |
| `130630` | Рідина AdBlue | — |
| `136040` | Послуги зарядної станції | — |

---

## 4. Shell — усі поля (128)

Запит: `POST https://api.shell.com/fleetmanagement/v1/transaction/pricedtransactions`, заголовки
`Authorization: Basic …` та `apikey`. Тіло: `{ ColCoCode, PayerNumber, InvoiceStatus: "A", FromDate: "yyyyMMdd",
ToDate, IncludeFees: true, PageSize, CurrentPage }`.
Відповідь: `{ "Transactions": [ … ], "RowCount", "TotalPages", "CurrentPage", "Error": { "Code": "0000", … }, "RequestId", "TransactionsLite": null }`.

Приклади — з рядка дизеля (27.08.2026, АЗС Shell у Русе, 101,03 л). Якщо в пальному поле порожнє,
приклад узято з рядка толу або збору, це позначено. **Заповнено** — частка непорожніх значень
за останній місяць: ~57 % = є лише в продажах (`SalesItem`), ~87 % = є в рядках з карткою,
0 % = завжди порожнє.

| Поле | Тип | Приклад | Що означає | Заповнено |
|---|---|---|---|---|
| `AccountId` | число | `19511` | ID рахунку клієнта в Shell | 100 % |
| `AccountName` | рядок | `"VELES BUKOVYNA LTD"` | Назва рахунку | 100 % |
| `AccountNumber` | рядок | `"PL60039295"` | Номер рахунку | 100 % |
| `AccountShortName` | рядок | `"VELES BUKOVYNA LTD"` | Коротка назва рахунку | 100 % |
| `Additional1` | рядок | `"2026-0000000039558956"` (тол) | Додаткове поле; заповнене лише в рядках толу — ідентифікатор толової операції | 48 % |
| `Additional2` | рядок | `""` | Додаткове поле | 0 % |
| `Additional3` | рядок | `""` | Додаткове поле | 0 % |
| `Additional4` | рядок | `""` | Додаткове поле | 0 % |
| `AllowClearing` | рядок | `"Y"` | Чи дозволено клірінг (операцію не списано) | 57 % |
| `AuthorisationCode` | рядок | `"793172"` | Код авторизації; лише пальне й AdBlue | 9 % |
| `CardExpiry` | рядок / null | `"20270630"` | Термін дії картки, `yyyyMMdd` | 87 % |
| `CardExpiryPeriod` | рядок | `"2706"` | Термін дії картки, `YYMM` | 87 % |
| `CardGroupId` | рядок | `""` | Група карток | 0 % |
| `CardGroupName` | рядок | `""` | Назва групи карток | 0 % |
| `CardId` | число / null | `883304` | ID картки в Shell | 87 % |
| `CardPAN` | рядок | `"707742•••••••••0442"` | Номер картки, 19 цифр, **повний** (тут замасковано); порожній у зборах рівня рахунку (оренда OBU, пеня) | 87 % |
| `CardSequenceNumber` | рядок | `"044"` | Порядковий номер картки (цифри 16–18 номера) | 87 % |
| `CardType` | рядок | `"UA CRT INT MUL R7"` | Тип картки: `…MUL R7` — паливна, `…TMF ETOLL` — для толу | 87 % |
| `CheckDigit` | рядок | `"2"` | Контрольна (остання) цифра номера картки | 87 % |
| `ColCoExchangeRate` | число | `1` | Курс ColCo, завжди `1` | 100 % |
| `CorrectionFlag` | рядок | `"N"` | Ознака коригування `Y` / `N` | 99,7 % |
| `CreditDebitCode` | рядок | `"D"` | `D` — списання, `C` — кредит (повернення/коригування, сума від'ємна) | 100 % |
| `CRMNumber` | рядок | `""` | Номер справи в CRM, якщо операцію оскаржено | 0 % |
| `CustomerCountry` | рядок | `"Ukraine"` | Країна клієнта | 100 % |
| `CustomerCountryCode` | рядок | `"UA"` | Код країни клієнта | 100 % |
| `CustomerCurrencyCode` | рядок | `"EUR"` | Валюта клієнта (= валюта інвойсу) | 100 % |
| `CustomerCurrencySymbol` | рядок | `"€"` | Символ валюти клієнта | 100 % |
| `CustomerRetailPriceUnitGross` | число / null | `1.88` | Ціна на стелі за одиницю з ПДВ, EUR | 57 % |
| `CustomerRetailValueTotalGross` | число / null | `189.94` | Сума за ціною стели з ПДВ, EUR | 57 % |
| `CustomerRetailValueTotalNet` | число / null | `158.28` | Сума за ціною стели без ПДВ, EUR | 57 % |
| `DelcoCode` | рядок | `"031"` | Код продавця (Delco) | 100 % |
| `DelCoExchangeRate` | число / null | `1` | Курс: одиниць валюти транзакції за 1 EUR (EUR — 1, TRY ≈ 51, HUF ≈ 355); у зборах `null` | 57 % |
| `DelcoListPriceUnitNet` | число / null | `1.617` | Прайсова ціна без ПДВ; заповнена при `DiscountType = "65"`, інакше `0` | 57 % |
| `DelcoName` | рядок | `"Shell Bulgaria EAD"` | Продавець: `Shell Bulgaria EAD` (пальне), `Toll4Europe Bulgaria` (тол), `Shell Polska sp. z o.o.` (збори) | 100 % |
| `DelcoRetailPriceUnitNet` | число / null | `1.5667` | Ціна на стелі за одиницю без ПДВ, валюта транзакції | 57 % |
| `DelCoToColCoExchangeRate` | число / null | `1` | Те саме, що `DelCoExchangeRate` | 57 % |
| `DelcoRetailPriceUnitGross` | число / null | `1.88` | Ціна на стелі за одиницю з ПДВ, валюта транзакції | 57 % |
| `DelcoRetailValueTotalNet` | число / null | `158.28` | Сума за ціною стели без ПДВ, валюта транзакції | 57 % |
| `DelcoRetailValueTotalGross` | число / null | `189.94` | Сума за ціною стели з ПДВ (= `Quantity × DelcoRetailPriceUnitGross`) | 57 % |
| `DiscountType` | рядок | `"65"` | Як рахується ціна: `65` — від прайсу (`DelcoListPriceUnitNet` + знижка; дизель), `66` — від стели (AdBlue, тол) | 57 % |
| `DisputeStatus` | рядок | `"No Dispute"` | Статус спору | 57 % |
| `DriverName` | рядок | `"CE4067EE"` (тол) | «Водій» на картці — у наших картках це **держномер**, а не ПІБ | 48 % |
| `EffectiveDiscountInCustomerCurrency` | число / null | `-9.8` | Сума знижки без ПДВ, EUR | 57 % |
| `EffectiveDiscountInTrxCurrency` | число / null | `-9.8` | Сума знижки без ПДВ, валюта транзакції (= `UnitDiscountTransactionCurrency × Quantity`) | 57 % |
| `EffectiveUnitDiscountInCustomerCurrency` | число / null | `-0.097` | Знижка на одиницю без ПДВ, EUR | 57 % |
| `EuroRebateAmount` | число / null | `-0.097` | Знижка на одиницю, EUR (попри назву — не загальна сума) | 57 % |
| `EuroVATAmount` | число / null | `30.71` | Сума ПДВ, EUR (= `InvoiceTax`) | 57 % |
| `FleetIDDescription` | рядок | `""` | Опис Fleet ID | 0 % |
| `FleetIdInput` | рядок | `"CE5465BM "` | Fleet ID, введений водієм на АЗС, — держномер (з пробілом у кінці) | 9 % |
| `FuelProduct` | boolean | `true` | `true` — пальне або AdBlue | 100 % |
| `IncomingCurrencyCode` | рядок | `"EUR"` | Валюта, в якій операція прийшла від мережі | 57 % |
| `IncomingProductCode` | рядок | `"30"` | Код товару від мережі (= `ProductCode`) | 100 % |
| `IncomingSiteDescription` | рядок | `"Shell Danube Bridge"` | Назва АЗС від мережі | 57 % |
| `IncomingSiteNumber` | рядок | `"5012"` | Номер АЗС від мережі (= `SiteCode`) | 57 % |
| `InvoiceCurrencyCode` | рядок | `"EUR"` | Валюта інвойсу | 100 % |
| `InvoiceCurrencySymbol` | рядок | `"€"` | Символ валюти інвойсу | 100 % |
| `InvoiceDate` | рядок / null | `"20260831 00:00:00"` | Дата інвойсу, `yyyyMMdd HH:mm:ss`; `null` — ще не виставлено | 83 % |
| `InvoiceGrossAmount` | число | `184.28` | **Сума в інвойсі з ПДВ, EUR** (= `InvoiceNetAmount + InvoiceTax`) | 100 % |
| `InvoiceNetAmount` | число | `153.57` | Сума в інвойсі без ПДВ, EUR | 100 % |
| `InvoiceNumber` | рядок | `"1500799260"` | Номер інвойсу; `""` — ще не виставлено | 83 % |
| `InvoiceTax` | число | `30.71` | ПДВ в інвойсі, EUR | 100 % |
| `IsInvoiced` | boolean | `true` | Чи операція вже в інвойсі | 100 % |
| `IsShellSite` | boolean / null | `true` | Чи АЗС мережі Shell (тол — `false`, збори — `null`) | 57 % |
| `IssuerCode` | рядок | `"7077"` | Перші цифри номера картки (7077 — CRT) | 87 % |
| `Location` | обʼєкт | `{ "Latitude": "43.876", "Longitude": "26.018" }` | Координати АЗС **рядками**; у толі й зборах — порожні рядки. У документації Shell поле названо `SiteLocation` | 9 % |
| `NetEuroAmount` | число / null | `153.57` | Сума без ПДВ, EUR (= `InvoiceNetAmount`) | 57 % |
| `NetInvoiceIndicator` | рядок | `"N"` | Чи виставляється інвойс без ПДВ | 57 % |
| `Network` | рядок | `"Shell BG EUR"` | Мережа | 57 % |
| `NetworkCode` | рядок | `"SHELL EUR"` | Код мережі | 57 % |
| `OdometerInput` | число / null | `0` | Пробіг, введений водієм; майже завжди `0` або `null` | 9 % |
| `OriginalSalesItemId` | рядок | `""` | `SalesItemId` початкової операції, якщо це повернення | 0 % |
| `ParentCustomerId` | null | `null` | ID материнського клієнта | 0 % |
| `ParentCustomerName` | рядок | `""` | Назва материнського клієнта | 0 % |
| `ParentCustomerNumber` | рядок | `""` | Номер материнського клієнта | 0 % |
| `PayerGroup` | рядок | `""` | Група платників | 0 % |
| `PayerGroupName` | рядок | `""` | Назва групи платників | 0 % |
| `PayerName` | рядок | `"VELES BUKOVYNA LTD"` | Назва платника | 100 % |
| `PayerNumber` | рядок | `"PL60039295"` | Номер платника | 100 % |
| `PINIndicator` | рядок | `"PIN Used"` | Чи вводився PIN: `PIN Used` / `No PIN` | 57 % |
| `PostingDate` | рядок | `"20260827 09:49:14"` | Дата й час проведення в Shell, `yyyyMMdd HH:mm:ss` | 100 % |
| `ProductCode` | рядок | `"30"` | Код товару Shell (§4.2) | 100 % |
| `ProductGroupId` | число | `7` | Група товару (§4.2) | 100 % |
| `ProductGroupName` | рядок | `"Automotive Gas Oil"` | Назва групи товару, англ. | 100 % |
| `ProductName` | рядок | `"Diesel AGO"` | Назва товару, англ. | 100 % |
| `PurchasedInCountry` | рядок | `"Bulgaria"` | Країна операції | 57 % |
| `PurchasedInCountryCode` | рядок | `"BG"` | ISO-код країни операції | 57 % |
| `Quantity` | число | `101.03` | Пальне — **літри**; тол — `1`; збори — база нарахування комісії, не літри | 100 % |
| `RebateonNetAmountInCustomerCurrency` | число / null | `-1.96` | ПДВ-частина знижки, EUR (= знижка × ставка ПДВ) | 57 % |
| `RebateonNetAmountInTransactionCurrency` | число / null | `-1.96` | Те саме у валюті транзакції | 57 % |
| `RebateRate` | число / null | `-7.6579650651` | Знижка у відсотках (від'ємна) | 57 % |
| `ReceiptNumber` | рядок | `"146558"` | Номер чека; у зборах = `SalesItemId` | 52 % |
| `RefundFlag` | рядок | `"N"` | Ознака повернення `Y` / `N` | 57 % |
| `ReleaseCode` | рядок | `"7"` | 7-ма цифра номера картки (`7` — паливна, `3` — толова) | 87 % |
| `SalesItemId` | число (64 біти) → у файлі рядок | `"4611686018933871270"` | **Унікальний ID рядка**. У продажах ≈ 4,6·10¹⁸ — більше за точність JavaScript, тому у файлі записано рядком; у зборах звичайне число (`48235662`) | 100 % |
| `SiteCode` | рядок | `"5012"` | Код АЗС; `T4BG` — віртуальна «станція» толу Болгарії | 57 % |
| `SiteCountry` | рядок | `"Bulgaria"` | Країна АЗС | 57 % |
| `SiteGroupId` | число / null | `3105` | ID групи АЗС | 57 % |
| `SiteGroupName` | рядок | `"BG 9800 SUPER ECONOMY EUR"` | Назва групи АЗС | 57 % |
| `SiteName` | рядок | `"5012 SHELL RUSSE DANUBE BRIDGE"` | Назва АЗС | 57 % |
| `TransactionCurrencyCode` | рядок | `"EUR"` | Валюта транзакції: у продажах — валюта країни (EUR, TRY, HUF, RON), у зборах — PLN | 100 % |
| `TransactionCurrencySymbol` | рядок | `"€"` | Символ валюти транзакції | 100 % |
| `TransactionDate` | рядок | `"20260827"` | Дата операції, `yyyyMMdd`, місцева | 100 % |
| `TransactionGrossAmount` | число | `184.28` | Сума з ПДВ у валюті транзакції (= `TransactionNetAmount + TransactionTax`) | 100 % |
| `TransactionId` | рядок | `"48F16F61C260827D626"` | ID покупки (рядків може бути кілька — див. `TransactionLine`); у толі `"BG0000000000000227868484"`, у зборах `""` | 57 % |
| `TransactionLine` | рядок | `"1"` | № рядка в покупці (`"2"` — наприклад, AdBlue разом із дизелем) | 57 % |
| `TransactionNetAmount` | число | `153.57` | Сума без ПДВ у валюті транзакції (= `Quantity × UnitPriceInTransactionCurrency`) | 100 % |
| `TransactionStatus` | рядок | `"I"` | `I` — в інвойсі, `U` — ще ні | 100 % |
| `TransactionTax` | число | `30.71` | ПДВ у валюті транзакції | 100 % |
| `TransactionTime` | рядок | `"08:59:36"` | Час операції, `HH:mm:ss`, місцевий; у зборах часто `00:00:00` | 100 % |
| `TransactionType` | рядок | `"Purchase"` | Тип транзакції (лише продажі) | 57 % |
| `TransactionTypeDescription` | рядок | `"1-Purchase"` | Опис типу транзакції | 57 % |
| `TrnIdentifier` | рядок | `"374611686018933871270"` | «37» + `SalesItemId`; унікальний рядковий ID для всіх рядків | 100 % |
| `Type` | рядок | `"SalesItem"` | `SalesItem` — продаж (пальне, AdBlue, тол), `FeeItem` — збір або комісія | 100 % |
| `UnitDiscountInvoiceCurrency` | число / null | `-0.11640106898940909` | Знижка на одиницю **з ПДВ**, EUR (= `UnitDiscountTransactionCurrency × (1 + VATRate)` / курс, з «хвостом» float) | 57 % |
| `UnitDiscountTransactionCurrency` | число / null | `-0.097` | Знижка на одиницю без ПДВ, валюта транзакції | 57 % |
| `UnitPriceInInvoiceCurrency` | число / null | `1.52` | Ціна клієнта за одиницю **без ПДВ**, EUR | 57 % |
| `UnitPriceInTransactionCurrency` | число / null | `1.52` | Ціна клієнта за одиницю **без ПДВ** (уже зі знижкою), валюта транзакції | 57 % |
| `UTCOffset` | рядок | `"+03:00:00"` | Зсув місцевого часу від UTC (лише продажі) | 57 % |
| `VATApplicable` | рядок | `"Y"` | Чи застосовано ПДВ | 100 % |
| `VATCategory` | рядок | `"28"` | Код категорії ПДВ Shell; у даних `28` — пальне й AdBlue, `70` — комісії й оренда OBU, `89` — тол і пеня | 100 % |
| `VATCountry` | рядок | `"Ukraine"` | Країна ПДВ клієнта | 100 % |
| `VATonNetAmount` | число | `30.71` | ПДВ у валюті транзакції (= `TransactionTax`) | 100 % |
| `VATonNetAmountInCustomerCurrency` | число | `30.71` | ПДВ в EUR (= `InvoiceTax`) | 100 % |
| `VATRate` | число | `0.2` | Ставка ПДВ (`0.2` = 20 %); у толі та зборах `0` | 100 % |
| `VehicleRegistration` | рядок | `"CE5465BM"` | Держномер ТЗ, надрукований на картці | 87 % |
| `EVPrintedNumber` | рядок | `""` | Номер картки для електрозарядки | 0 % |
| `IsRFID` | boolean / null | `false` | Чи RFID-носій | 57 % |
| `TokenTypeDescription` | рядок | `"UA CRT INT MUL - CHIP"` | Носій: `UA CRT INT MUL - CHIP` — пластикова паливна картка, `VIRTUAL PLASTIC (ETOLL & APA)` — віртуальна для толу | 57 % |

### 4.2. Коди товарів Shell в останньому місяці

| `ProductCode` | `ProductName` | `ProductGroupId` · `ProductGroupName` | `Type` | Що це | Рядків |
|---|---|---|---|---|---|
| `14` | Road tax | `30` · Essential road services | SalesItem | Плата за дороги (тол) Болгарії через Toll4Europe, ПДВ 0 | 281 |
| `6` | Transaction Fee BG731 14 | `22` · Card related fees | FeeItem | Комісія Shell ≈ 4 % від `Quantity` (бази); за назвою — за тол (код `14`) | 147 |
| `404` | OBU monthly rental fee | `24` · Service Fee | FeeItem | Щомісячна оренда бортового пристрою OBU для толу, 19,06 PLN | 77 |
| `6` | Transaction Fee BG031 GFUE | `22` · Card related fees | FeeItem | Комісія Shell 1 % від `Quantity` (бази); за назвою — за пальне | 26 |
| `30` | Diesel AGO | `7` · Automotive Gas Oil | SalesItem | Дизельне пальне | 26 |
| `38` | AdBlue Bulk | `8` · Alternative Fuel | SalesItem | AdBlue з колонки | 26 |
| `33` | High Performance Diesel | `7` · Automotive Gas Oil | SalesItem | Преміальне дизельне пальне | 1 |
| `1` | Late Payment Fee | `23` · Monetary Adjustment | FeeItem | Пеня за прострочену оплату | 1 |

Раніше в 2026 році траплялись також: `32` Fuel Economy Diesel (AGO Low Sulphur), `39` AdBlue Packed,
`1` Invoice Adjustment, `197` VAT Refund - Standard, комісії `TR041 GFUE`, `HU134 14`, `SI730 14`,
`RO138 GFUE`, `HU034 GFUE`, `EU867 197`; операції в Туреччині, Угорщині, Словенії та Румунії
(валюти TRY, HUF, RON). Коди з документації Shell `11` Tunnel/Bridges, `12` Motorway toll,
`13` Ferries у наших даних не зустрічались: тол приходить як `14` Road tax.

---

## 5. Приклад: одна заправка в обох вендорів

| Що | OKKO — 27.08.2026, А-95 | Shell — 27.08.2026, дизель, Болгарія |
|---|---|---|
| Коли | `trans_date` `2026-08-27T16:10:47.000` | `TransactionDate` `20260827` + `TransactionTime` `08:59:36` (`UTCOffset` `+03:00:00`) |
| Картка | `card_num` `782539••••••0235` | `CardPAN` `707742•••••••••0442` |
| Авто | `person_last_name` `SKODA` | `VehicleRegistration` `CE5465BM` |
| АЗС | `azs_name` `АЗС 028 Франківськ ОККО-Драйв` | `SiteName` `5012 SHELL RUSSE DANUBE BRIDGE`, `BG` |
| Пальне | `product_desc` `Бензин А-95` | `ProductName` `Diesel AGO` |
| Кількість | `volume` `40000` → 40 л | `Quantity` `101.03` л |
| Ціна на стелі | `price` `8290` → 82,90 грн/л | `DelcoRetailPriceUnitGross` `1.88` €/л з ПДВ |
| Знижка | `price_discount` `400` → 4,00 грн/л; `amount_discount` `16000` → 160,00 грн | `UnitDiscountTransactionCurrency` `-0.097` €/л без ПДВ; `EffectiveDiscountInTrxCurrency` `-9.8` € |
| Ціна для клієнта | 78,90 грн/л (окремого поля немає) | `UnitPriceInTransactionCurrency` `1.52` €/л без ПДВ |
| Сума без ПДВ | — | `TransactionNetAmount` `153.57` € |
| ПДВ | — | `TransactionTax` `30.71` € (`VATRate` `0.2`) |
| **До сплати** | `amnt_acct` `315600` → **3 156,00 грн** | `TransactionGrossAmount` `184.28` € = `InvoiceGrossAmount` **184,28 €** |

---

## 6. На що звернути увагу при читанні даних

**OKKO**

- Гроші — **копійки**, обʼєм — **мілілітри** (цілі числа): ділити на 100 і на 1000.
- `amnt_trans` — сума **до** знижки; фактично списано `amnt_acct` (= `amnt_trans − amount_discount`,
  у 2 з 838 рядків знижку не віднято).
- Суми завжди додатні: поповнення договору (`687`) і повернення (`775`) відрізняються від заправки
  лише кодом `trans_type`.
- Порожніх значень немає — такі поля просто **відсутні** в JSON.
- Масив називається `items`, а не `transactions`, як у Swagger; `org_device` — рядок, `processed_in_bo` — число.
- Пагінація: `offset` — **номер сторінки** з нуля, а не зсув у рядках, як пише Swagger:
  `size=100&offset=1` дає рядки 101–200. `early_first` ігнорується: записи завжди від нових до старих.
  Один запит — не більше 31 дня.
- `person_first_name` / `person_last_name` — не водій, а мітка картки.

**Shell**

- `SalesItemId` у продажах — 64-бітне число (≈ 4,6·10¹⁸). Звичайний `JSON.parse` (JavaScript, частина
  JSON-бібліотек) його округлює: два рядки однієї покупки `…146566` (дизель) і `…146567` (AdBlue)
  стають однаковими. Треба читати його як рядок або брати рядковий `TrnIdentifier`.
- Дата `yyyyMMdd` і час `HH:mm:ss` — окремо; `PostingDate` / `InvoiceDate` — `yyyyMMdd HH:mm:ss`.
  У зборах час часто `00:00:00`, а `UTCOffset` порожній.
- Дві «грошові площини»: `Transaction*` — у валюті країни (у зборах PLN), `Invoice*` / `Customer*` /
  `…Euro…` — у EUR, як у рахунку. Для зборів курсу немає (`DelCoExchangeRate = null`).
- `UnitPriceIn…` — ціна **без ПДВ** і вже зі знижкою; ціна на стелі — `DelcoRetailPriceUnit…`.
- Знижки від'ємні (в OKKO навпаки).
- `Quantity` — літри лише для пального; у толі `1`, у зборах — база нарахування комісії.
- `DriverName` — це держномер; `FleetIdInput` має пробіл у кінці.
- Порожнє значення буває і `""`, і `null`; усі 128 ключів є завжди, 14 полів за місяць завжди порожні.
- Помилка приходить з HTTP 200: треба перевіряти `Error.Code` (`"0000"` = успіх).
  Один запит — не більше 210 днів; сторінка на 1000 рядків відповідає 15–25 с.
- `IncludeFees: true` — продажі разом зі зборами; без нього — лише продажі
  (за 01.08–15.09.2026: 828 рядків проти 528).
