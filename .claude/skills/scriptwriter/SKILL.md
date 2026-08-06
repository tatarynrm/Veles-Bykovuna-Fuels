---
name: scriptwriter
description: Narrative copy and script craft for VELES ERP — product voice, Ukrainian copywriting and typography rules, templates for video teasers, demo walkthroughs, feature announcements, landing-page hero copy and case studies, plus rules on claims and a pre-ship checklist. Use whenever writing or editing marketing copy, landing text, a video/demo script, a release note aimed at users, or any customer-facing narrative for this product.
---

# Scriptwriter — VELES ERP

You write the words that explain this product to people who move trucks for a living.
Audience: dispatchers, logistics managers, fleet owners — mostly in Ukraine, mostly people
who already keep three vendor cabinets open in three browser tabs. They do not read
marketing. They read to find out whether this saves them the third tab.

Source language is **Ukrainian**. Everything ships in Ukrainian first; en/pl/de are
translations of a finished Ukrainian original, never the other way round.

## 1. Voice

**Technical but human.** Say «рівень пального з CAN-шини», not «дані з бортових систем».
The reader knows what a CAN bus is; softening the term costs you credibility, not gains you
reach. But the sentence around it stays plain: short verbs, no participial chains.

**Confident without hype.** The product is genuinely useful and unremarkable in the way good
tools are. State what it does. Do not say it is revolutionary; nothing that aggregates two
fuel-card APIs is revolutionary.

**Concrete over adjective.** Every adjective you delete and replace with a number, an object,
or a verb makes the copy better. «Швидко» → «13 секунд на місячний період по двох мережах».
«Зручно» → «один екран замість трьох кабінетів».

**Ukrainian-first, not translated-sounding.** If a sentence would only make sense as a
translation of an English marketing page, rewrite it.

### Banned vocabulary

Never write, in any language: інноваційні рішення · синергія · комплексний підхід ·
цифрова трансформація · передові технології · унікальна платформа · вивести бізнес на новий
рівень · оптимізація бізнес-процесів · ми раді повідомити · не просто X, а Y ·
революційний · безшовний · екосистема (unless literally describing integrations) ·
«рішення» in the sense of *solution* (say what it is: сервіс, панель, звіт, інтеграція).

Also banned: exclamation marks in body copy, ALL-CAPS words for emphasis, rhetorical
questions as openers («Втомилися рахувати літри вручну?»).

## 2. Ukrainian copywriting rules

### Typography — non-negotiable

| Thing | Correct | Wrong |
|---|---|---|
| Quotes | «Велес Буковина», nested „так“ | "Велес Буковина", ""… |
| Dash | slovo — slovo (em dash, spaces both sides) | slovo - slovo, slovo– slovo |
| Hyphen | CAN-шина, GPS-трекер (no spaces) | CAN — шина |
| Apostrophe | обʼєм, пʼять (U+02BC, as in `uk.json`) | об'єм, об`єм, об’єм |
| Units | `40 л`, `2 год`, `120 км`, `1 250 ₴` — **non-breaking** space before the unit | 40л, 2 год wrapping to a new line |
| Thousands | 1 250, 18 400 — non-breaking thin space, never a comma | 1,250 · 1.250 |
| Decimals | 42,3 л · 1,87 ₴/л — comma | 42.3 л |
| Percent | 12% — no space | 12 % |
| Numeral + noun | 1 заправка · 2–4 заправки · 5 заправок | 5 заправка |
| Ranges | 3–5 с (en dash, no spaces) | 3 - 5 с |
| Ellipsis | … (one glyph) | ... |

Never end a line with a one-letter preposition (`у`, `з`, `в`, `і`, `на`) — bind it to the
next word with a non-breaking space. On a hero headline, check this at every breakpoint.

### Кальки to kill

From Russian: на протязі → **протягом** · приймати участь → **брати участь** ·
заказ → **замовлення** · у якості → **як** · відноситься → **стосується** ·
співпадає → **збігається** · являється → **є** · дана система → **ця система** ·
на даний момент → **зараз** · по замовчуванню → **за замовчуванням / типово** ·
включити/виключити (about a feature) → **увімкнути / вимкнути** · поставщик →
**постачальник** · водій-дальнобійник → **водій на міжнародних рейсах**.

From English: юзер → **користувач** · апдейт → **оновлення** · фідбек → **відгук** ·
івент → **подія** · дедлайн → **термін** · кейс is acceptable in B2B, кейс-стаді is not.

Word choice this product gets wrong often: **обʼєм** is a physical volume (літри пального);
**обсяг** is an amount or scope (обсяг витрат, обсяг даних). **Рейс** is the trip a truck
runs; **маршрут** is the geometry it follows; **поїздка** belongs to passengers, not freight.

### «Ви», not «ти»

Formal but warm. Lowercase `ви` in anything addressed to many readers (landing, video,
social, docs). Capital `Ви` **only** in a one-to-one letter to a named person. Prefer
impersonal constructions where the pronoun would repeat: «Видно, де літри не збігаються з
кілометрами» beats «Ви бачите, де ви маєте розбіжність».

### Product glossary — use exactly these

паливна картка · заправка (an event) · транзакція (its record) · мережа АЗС ·
телематика · CAN-шина · рівень пального · оберти двигуна · мотогодини · запалювання ·
пробіг · рейс · точка маршруту · диспетчер · автопарк · злив пального ·
нецільова заправка · звірка (reconciliation).

Vendor names stay as the vendors write them: **ОККО** (Cyrillic), **Shell** (Latin),
**Ruptela** / **fm-track** (Latin). Company: **ТОВ «Велес Буковина»**. Product: **VELES ERP**
(Latin, never «Велес ЕРП»).

## 3. Story structures

### A. Проблема → ціна → механізм → доказ

The default for B2B. Four beats, in this order, no skipping:

1. **Проблема** — a scene, not a category. Not «складний облік пального», but «кінець
   місяця, два вивантаження Excel і телематика в третьому вікні».
2. **Ціна** — what the problem costs in hours, літри or ₴. If you do not have a real number,
   name the *unit* of cost honestly: «пів дня диспетчера щомісяця» is a claim you can defend.
3. **Механізм** — *how* it is solved, technically. This is where the product earns trust:
   «дані ОККО і Shell зводяться в одну схему, телематика приходить окремим потоком, і обидва
   лягають на одну вісь дат». Never skip to the outcome.
4. **Доказ** — a screenshot, a live number, a named customer, or an explicit limit
   («поки що Shell працює на тестовому середовищі»). An admitted limit is proof; a claim
   without one is not.

### B. День диспетчера

For longer video and case studies. One person, one day, chronological:
07:40 планування рейсів · 10:15 дзвінок водія «пальне не зійшлося» · 14:00 нова картка ·
18:30 звіт власнику. Each moment shows one screen. The product never gets introduced — it is
simply what is open on the monitor the whole time. Ends on the thing that *did not* happen:
the evening spent on звірка.

Use A when the viewer does not know the category. Use B when they know it and doubt that
another dashboard changes anything.

## 4. Script formats

Two-column scripts. Left = what is on screen, right = what is heard. Voice-over is measured
at **~150 Ukrainian words per minute** — write to the clock, then cut 15%.

### 4.1 Тизер, 30 с

Structure: 0–3 с hook, 3–20 с three concrete capabilities, 20–27 с proof, 27–30 с CTA.
Under 75 words total. No music-video montage — one screen per beat, held long enough to read.

| Кадр | Голос |
|---|---|
| 0–3 с. Три вкладки браузера: кабінет ОККО, кабінет Shell, fm-track. Закриваються по черзі. | Три кабінети. Один автопарк. |
| 3–11 с. Дашборд VELES ERP, темна тема. Курсор наводить на графік витрат. | ОККО і Shell зводяться в один звіт: витрати, літри, середня ціна за літр — за будь-який період. |
| 11–20 с. Карта, мітка вантажівки рухається. Збоку — рівень пального, оберти, мотогодини. | Поруч — телематика Ruptela. Позиція оновлюється кожні 3 секунди, разом із рівнем пального з CAN-шини. |
| 20–27 с. Графік рівня пального з різким спадом на стоянці. | Тому різкий спад на стоянці видно того самого дня, а не в кінці місяця. |
| 27–30 с. Логотип, домен. | VELES ERP. Автопарк на одному екрані. |

### 4.2 Демо-огляд, 2 хв

Six blocks. One screen each, 15–25 с. Screen recording at 1920×1080, dark theme, guest
account with demo data. Never narrate the click («тепер натискаємо…») — narrate the intent
(«диспетчеру потрібно знайти, хто заправлявся поза маршрутом»).

```
00:00–00:12  Проблема. Голос над реальним екраном звірки в Excel.
00:12–00:35  Дашборд. Витрати за місяць, розподіл ОККО/Shell, топ АЗС.
             Один рядок про механізм: як дані нормалізуються в одну схему.
00:35–00:55  Транзакції. Фільтр за брендом і періодом, пошук по картці, експорт.
00:55–01:20  Телематика. Карта автопарку → одна машина → CAN: рівень пального,
             оберти, мотогодини. Показати null там, де датчик не звітує, і сказати чому.
01:20–01:40  Рейси. Створення рейсу, точки маршруту, призначення водія.
             Сказати вголос: рейс іде в Ruptela і може дійти до реального водія.
01:40–01:55  Обмеження й доступи. Гостьовий режим — тільки читання. Що вже працює,
             що ні.
01:55–02:00  CTA: один домен, одна дія.
```

The 01:40 block is not optional. A demo that never says what the product cannot do reads as
a demo that hid something.

### 4.3 Анонс функції

Four sentences, that is the whole format. Works as a release note, a Telegram post and the
body of an email without rewriting.

```
[Що зʼявилося.]        У картці машини зʼявився графік рівня пального за останні 24 години.
[Для кого і навіщо.]   Диспетчеру більше не треба відкривати телематику окремо, щоб
                       перевірити підозрілий спад.
[Як це працює.]        Дані беруться з CAN-шини разом із координатами, тому графік і трек
                       побудовані на одних і тих самих записах.
[Де знайти / межа.]    Телематика → машина → вкладка «Пальне». Якщо датчик не звітує,
                       точка на графіку порожня — ми не домальовуємо значень.
```

### 4.4 Hero лендінгу

Structure: заголовок (≤ 9 слів) · підзаголовок (≤ 24 слова, one sentence) · one primary CTA ·
one honest proof line under the fold.

```
H1     Автопарк, паливні картки й телематика — на одному екрані
Sub    VELES ERP зводить дані ОККО, Shell і Ruptela в один звіт: витрати, літри,
       рівень пального та рейси — без вивантажень і ручної звірки.
CTA    Подивитися демо
Proof  Три робочі інтеграції. Дані оновлюються онлайн. Гостьовий доступ — без реєстрації.
```

The H1 names the objects (автопарк, картки, телематика), not the benefit. In this category
the benefit is obvious and the objects are what the reader scans for.

### 4.5 Кейс

Five sections, 350–500 words, past tense, named company or explicitly anonymised
(«міжнародний перевізник, 28 тягачів, Чернівецька область»).

```
Компанія    Хто, скільки машин, які напрямки, які мережі АЗС.
Було        Один абзац фактів без оцінок: скільки кабінетів, скільки часу на звіт,
            що робили з розбіжностями.
Що зробили  Механізм. Які інтеграції підключили, за скільки, що довелося налаштувати.
Стало       Числа з періодом і джерелом: «за березень — квітень 2026, за даними
            панелі витрат».
Що не змінилося   Обовʼязковий розділ. Що продукт не вирішив.
```

The «Що не змінилося» section is what makes the other four believable.

## 5. Weak line → rewrite

**Landing hero**
- ✗ «Інноваційна платформа для комплексного управління автопарком, що забезпечує синергію даних і виводить логістику на новий рівень.»
- ✓ «Дві паливні мережі й телематика — в одному звіті. Без вивантажень і ручної звірки.»

**Fuel cards**
- ✗ «Зручне управління паливними картками у зручному інтерфейсі.»
- ✓ «Усі картки ОККО і Shell в одному списку: залишок, машина, останні заправки. Фільтр за мережею — одна вкладка.»

**Telematics**
- ✗ «Передові технології GPS-моніторингу в режимі реального часу!»
- ✓ «Позиція машини оновлюється кожні 3 секунди. Разом із нею приходять рівень пального, оберти й мотогодини — з CAN-шини, а не з розрахунку.»

**Missing data — the temptation to hide it**
- ✗ «Система гарантує повноту телематичних даних.»
- ✓ «Якщо датчик не передав значення, поле порожнє. Ми не підставляємо нулі — нуль охолоджувальної рідини означав би, що двигун замерз.»

**Trip planning**
- ✗ «Планування рейсів стало ще простішим і ефективнішим.»
- ✓ «Рейс створюється з точками маршруту й водієм і йде прямо в Ruptela. Водій побачить його в застосунку — тому чернетки краще тримати в статусі «новий».»

**Analytics**
- ✗ «Потужна аналітика допоможе вам приймати кращі рішення.»
- ✓ «Витрати по днях, розподіл за марками пального, середня ціна за літр і знижки за період. Дві мережі на одній осі дат.»

**Integrations**
- ✗ «Ми інтегруємося з провідними постачальниками галузі.»
- ✓ «ОККО, Shell, Ruptela. Не «в дорожній карті» — три підключення, з яких дані приходять зараз. Shell поки що на тестовому середовищі, і на сторінці інтеграцій це написано.»

**CTA**
- ✗ «Дізнайтеся більше про можливості нашої системи!»
- ✓ «Подивитися демо — гостьовий доступ, без реєстрації.»

## 6. Rules for claims

**Never invent a metric.** Not «до −20% витрат», not «окупність за два місяці», not
«economy of 15%». If you did not measure it, it does not exist.

Any number that appears in copy must be one of three kinds, and you must be able to say
which:

1. **Виміряне** — comes from real data. Cite the period and the source in the copy itself:
   «за березень 2026, за даними панелі витрат».
2. **Технічне** — a property of the system or a vendor API, verifiable in the code or docs:
   інтервал опитування 3/5/10/30 с · вікно запиту ОККО — максимум 30 днів · кеш 30 с ·
   чотири мови інтерфейсу. These are safe and they are the best material you have.
3. **Ілюстративне** — explicitly framed as an example: «умовний автопарк на 30 машин»,
   «на демоданих». The frame goes in the same sentence, not in a footnote.

**State the status honestly.** Shell runs against the vendor's **test** environment.
Waypoint-checklist ticks are dispatcher-local. Some Ruptela fields (двері, температура
рефрижератора, рік машини) do not exist on this hardware and never will — never show them in
a mockup. Guest access is read-only by design; say that as a feature, because it is one.

**Never put real operational data in public material.** No real plate numbers, driver names,
card numbers (even partly masked), contract numbers, merchant addresses, or actual transaction
sums in a screenshot, video frame or slide. Record demos on the guest/demo account. If a real
frame slipped in, the fix is a re-record, not a blur.

**Translation is not a rewrite.** en/pl/de versions must not gain a claim the Ukrainian
original does not make. When copy lands in the app, it goes through `t()` and
`frontend/src/locales/*.json` like everything else — write the Ukrainian, let the
`i18n-translator` agent carry it across.

## 7. Pre-ship checklist

1. Read it aloud. Anything you stumble on is one sentence doing two jobs — split it.
2. Delete every adjective. Put back only those whose absence changes the meaning.
3. Grep for the banned vocabulary list in §1. Zero hits.
4. Every number: which of the three kinds (§6) is it? If you cannot say, cut it.
5. Typography pass: « » quotes, — with spaces, `ʼ` apostrophe, non-breaking space before
   every unit and after every one-letter preposition, comma decimals.
6. Кальки pass against §2.
7. Does the piece say anywhere what the product does **not** do? If not, add it.
8. Any real vehicle, driver, card or sum visible in the assets? Re-shoot.
9. Word count against the clock for scripts: words ÷ 150 = minutes. Over budget → cut,
   do not speed up the read.
10. First line test: if the first sentence were the only thing read, would a dispatcher know
    whether this is for them?
