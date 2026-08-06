'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, cubicBezier, type MotionValue } from 'framer-motion';
import { Fuel, Navigation, CreditCard, Truck } from 'lucide-react';
import { useScrollProgress } from '@/shared/lib/useScrollProgress';
import { useTween } from '@/shared/lib/useTween';
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion';
import { seededRandom } from '@/shared/lib/seededRandom';
import { EASE_ENTER } from '@/shared/lib/motion';
import { useSound } from '@/features/sound';
import { t, intlLocale } from '@/lib/i18n';
import {
  FLEET_DAY, FLEET_CUMULATIVE, FLEET_SIZE, MAX_HOUR_FUEL, MAX_HOUR_ACTIVE,
} from '@/shared/config/fleetDay';

const pad = (n: number) => String(n).padStart(2, '0');
/** Розділювачі розрядів залежать від мови: 4 560 · 4,560 · 4.560. */
const num = (n: number) => Math.round(n).toLocaleString(intlLocale());
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Позначки часової шкали під графіком. */
const SCALE_LABELS = ['00', '06', '12', '18', '23'];

/**
 * ▸ ПОРІГ СМУЖОК ВОДІЇВ ◂
 *
 * Поділка шкали, яку має перетнути заповнена частина графіка, щоб пішли
 * смужки. Нумерація 1-based — так, як поділки читають на екрані:
 * 1 → 00:00, 2 → 06:00, 3 → 12:00, 4 → 18:00, 5 → 23:00.
 *
 * Це єдине місце, де налаштовується момент запуску: години й прогрес скролу
 * нижче виводяться з нього, а не дублюють магічне число.
 */
export const DRIVER_STRIPS_TRIGGER_SCALE_INDEX = 2;

/** Частка ширини графіка, на якій стоїть та поділка (поділки розкладені рівномірно). */
const TRIGGER_FRACTION = (DRIVER_STRIPS_TRIGGER_SCALE_INDEX - 1) / (SCALE_LABELS.length - 1);

/**
 * Перша година, на якій заповнена частина графіка дотягується до поділки.
 * Заповнено `(hour + 1) / 24` ширини, тож поріг переходиться на
 * `ceil(частка · 24) - 1`. Для 06:00 (чверть ширини) це 5-та година.
 */
const TRIGGER_HOUR = Math.max(0, Math.ceil(TRIGGER_FRACTION * FLEET_DAY.length) - 1);

/** Скільки «сходинок» скролу на добу: година рахується як round(progress · 23). */
const HOUR_STEPS = FLEET_DAY.length - 1;

/** Прогрес скролу, на якому годинник перемикається на годину `h`. */
const progressAtHour = (h: number) => clamp01((h - 0.5) / HOUR_STEPS);

const TRIGGER_PROGRESS = progressAtHour(TRIGGER_HOUR);

/** На скільки пікселів графік відходить донизу, звільняючи смужкам місце. */
const CHART_SHIFT_PX = 28;
/** За який шматок прогресу скролу цей зсув відпрацьовує повністю. */
const CHART_SHIFT_SPAN = 0.08;

/**
 * Висота смуги, в якій живуть смужки: проміжок між картками й графіком
 * (`mb-10` = 40px) плюс зсув графіка, плюс запас, який заходить під картки —
 * там смужки вже вигасають і їх зрізає `overflow: hidden`.
 */
const DRIVER_LANE_PX = 88;
const DRIVER_STRIP_WIDTH_PX = 9;
const DRIVER_STRIP_MIN_H_PX = 26;
const DRIVER_STRIP_H_SPREAD_PX = 16;
/** Розкид стартових затримок у прогресі скролу — саме він ламає «марш». */
const DRIVER_STRIP_DELAY_SPREAD = 0.085;
const DRIVER_STRIP_MIN_DURATION = 0.14;
const DRIVER_STRIP_DURATION_SPREAD = 0.16;
/** Горизонтальне «гуляння» смужки, px в кожен бік. */
const DRIVER_STRIP_JITTER_PX = 7;
/** Фіксований seed: хаос має бути однаковим на сервері, клієнті й після ре-рендера. */
const DRIVER_STRIP_SEED = 0x5e1e5;

/** Тільки токени теми — сирі кольори ламають світлу тему. */
const DRIVER_STRIP_TONES = ['--accent-rgb', '--warn-rgb', '--info-rgb'];

/**
 * Підпис під графіком їде донизу разом із панеллю — інакше зсунута панель
 * з'їдає `mt-4` і накриває текст. Тому вікно зсуву тут те саме, що в графіка,
 * а відстань трохи більша: підпис ще й підростає, і йому потрібен просвіт.
 */
const CAPTION_SHIFT_PX = CHART_SHIFT_PX + 8;
const CAPTION_SCALE_TO = 1.28;
/** За який шматок прогресу підсвітка пробігає підпис від першої літери до останньої. */
const CAPTION_SWEEP_SPAN = 0.24;
/** Ширина «голови» підсвітки в літерах: що більша, то довший хвіст затухання. */
const CAPTION_GLOW_LETTERS = 7;

/**
 * Година, на якій «виїжджає» i-та смужка: коли парк уперше має стільки машин
 * у русі — але не раніше за поріг. Кількість смужок таким чином тягнеться з
 * даних (`active`), а не задається числом: о 5:00 їх 21, на піку — 57.
 */
const DRIVER_RELEASE_HOUR = Array.from({ length: MAX_HOUR_ACTIVE }, (_, i) => {
  const h = FLEET_DAY.findIndex(r => r.hour >= TRIGGER_HOUR && r.active >= i + 1);
  return h === -1 ? HOUR_STEPS : h;
});

const EASE_RISE = cubicBezier(...EASE_ENTER);

interface DriverStripParams {
  id: number;
  /** Позиція центра смужки, % ширини графіка. */
  left: number;
  /** Прогрес скролу, на якому смужка рушає / повністю виходить із смуги. */
  start: number;
  end: number;
  height: number;
  jitter: number;
  /** Скільки півхвиль гуляння встигає за політ. */
  wobble: number;
  phase: number;
  tone: string;
}

/**
 * Доба парку, прокручена скролом.
 *
 * Секція втричі вища за екран, а її вміст тримається на `position: sticky`,
 * тож прокрутка крізь неї скрабить годину з 00 до 23.
 *
 * Закріплення — чистий CSS. GSAP-у тут навмисно немає: ScrollTrigger.pin
 * кешує межі на момент створення, а тригер створюється після динамічного
 * імпорту, вже після події `load`. Варто заголовковому шрифту доверстати
 * сторінку — і секція закріплювалась за старими координатами, у які
 * користувач ніколи не потрапляв.
 *
 * React-стан оновлюється лише на цілу годину — 24 перемальовування на всю
 * секцію замість одного на кожен кадр скролу. Проміжні значення згладжує
 * useTween, тож цифри рухаються плавно, хоч джерело в них дискретне.
 *
 * Смужки водіїв (див. `DRIVER_STRIPS_TRIGGER_SCALE_INDEX`) — окремий шар
 * поверх цієї логіки. Він теж живиться прогресом скролу, але не через стан:
 * той самий колбек кладе безперервне значення у MotionValue, а framer-motion
 * рахує з нього transform поза React. Тому шар не додає жодного зайвого
 * рендера й скрабиться в обидва боки без ривків.
 */
export default function FleetDayScrubber() {
  const sectionRef = useRef<HTMLElement>(null);
  const hourRef = useRef(0);
  const [hour, setHour] = useState(0);
  const reduced = usePrefersReducedMotion();
  const { play } = useSound();

  /** Безперервний прогрес секції — джерело для смужок і зсуву графіка. */
  const scrollProgress = useMotionValue(0);

  const handleProgress = useCallback(
    (progress: number) => {
      // Спершу безперервне значення: воно потрібне кожен кадр, а не раз на годину.
      scrollProgress.set(progress);

      const next = Math.min(23, Math.round(progress * 23));
      if (next === hourRef.current) return;
      hourRef.current = next;
      setHour(next);
      play(next === 23 ? 'rev' : 'tick');
    },
    [play, scrollProgress],
  );

  useScrollProgress(sectionRef, handleProgress);

  // Без анімацій скраб не працює — показуємо підсумок доби, а не порожню ніч.
  const shownHour = reduced ? 23 : hour;
  const row = FLEET_DAY[shownHour];
  const total = FLEET_CUMULATIVE[shownHour];

  const active = useTween(row.active);
  const fuel = useTween(total.fuel);
  const distance = useTween(total.distance);
  const tx = useTween(total.tx);

  // Тут лежать КЛЮЧІ; t() стоїть у місці рендеру нижче.
  const metrics = [
    { icon: Truck,      label: 'landing.metricMoving',   value: `${num(active)}/${FLEET_SIZE}`, tone: 'var(--accent)' },
    { icon: Fuel,       label: 'landing.metricFuel',     value: num(fuel),                      tone: 'var(--warn)' },
    { icon: Navigation, label: 'landing.metricDistance', value: num(distance),                  tone: 'var(--info)' },
    { icon: CreditCard, label: 'landing.metricRefuels',  value: num(tx),                        tone: 'var(--accent)' },
  ];

  /*
    Випадкові параметри рахуються один раз і з фіксованим seed. Прогрес скролу
    — величина двонаправлена: якби затримки й швидкості пересівалися на
    рендері, прокрутка назад показувала б уже інший «хаос».
  */
  const strips = useMemo<DriverStripParams[]>(() => {
    const rnd = seededRandom(DRIVER_STRIP_SEED);
    return DRIVER_RELEASE_HOUR.map((releaseHour, i) => {
      const duration = DRIVER_STRIP_MIN_DURATION + rnd() * DRIVER_STRIP_DURATION_SPREAD;
      const start = Math.min(
        progressAtHour(releaseHour) + rnd() * DRIVER_STRIP_DELAY_SPREAD,
        1 - duration,
      );
      return {
        id: i,
        left: ((i + 0.5) / MAX_HOUR_ACTIVE) * 100,
        start,
        end: start + duration,
        height: DRIVER_STRIP_MIN_H_PX + rnd() * DRIVER_STRIP_H_SPREAD_PX,
        jitter: (rnd() * 2 - 1) * DRIVER_STRIP_JITTER_PX,
        wobble: 0.6 + rnd() * 1.6,
        phase: rnd() * Math.PI * 2,
        tone: DRIVER_STRIP_TONES[Math.floor(rnd() * DRIVER_STRIP_TONES.length)],
      };
    });
  }, []);

  /*
    Скільки смужок уже «випущено». Рахується з години, тому оновлюється разом
    зі звичайним рендером секції — окремої підписки на скрол не треба.
  */
  const stripCount = reduced
    ? row.active
    : DRIVER_RELEASE_HOUR.filter(h => h <= hour).length;

  const chartShift = useTransform(
    scrollProgress,
    [TRIGGER_PROGRESS, TRIGGER_PROGRESS + CHART_SHIFT_SPAN],
    [0, CHART_SHIFT_PX],
    { ease: EASE_RISE },
  );

  return (
    /*
      Висота задає хід прокрутки, від якого рахується година, тож вона тут
      інлайн-стилем — це єдина властивість, без якої секція не працює взагалі,
      а не просто виглядає інакше.

      300vh дає 200vh ходу на 24 години, приблизно 8vh на годину: зміну видно,
      і секція не здається пасткою.
    */
    <section id="fleet-day" ref={sectionRef} className="relative" style={{ height: '300vh' }}>
      <div className="sticky top-0 flex min-h-screen items-center px-5 py-20 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <p className="micro-label mb-3" style={{ color: 'var(--warn)' }}>
            {t('landing.fleetDayEyebrow')}
          </p>
          <h2 className="font-display mb-2 text-[28px] leading-[1.15] sm:text-[34px]">
            {t('landing.fleetDayTitle')}
          </h2>
          <p className="mb-10 max-w-lg text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('landing.fleetDayLead')}
          </p>

          {/* Годинник */}
          <div className="mb-8 flex items-baseline gap-4">
            <span
              className="font-display text-[64px] leading-none sm:text-[88px]"
              data-numeric
              style={{ color: 'var(--text-primary)' }}
            >
              {pad(shownHour)}
            </span>
            <span className="font-display text-[28px] leading-none" style={{ color: 'var(--text-muted)' }}>
              :00
            </span>
            <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('landing.cumulativeFrom')}
            </span>
          </div>

          {/*
            Картки й графік — сусіди в одному стеку. Картки з `z-10`, графік з
            `z-0`: смужки живуть усередині графіка, тож проходять під картками
            й не можуть із-під них вилізти, хай який z-index їм дати.
          */}
          <div className="relative z-10 mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map(m => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="glass-panel p-4">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Icon size={14} style={{ color: m.tone }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {t(m.label)}
                    </span>
                  </div>
                  <p className="text-2xl font-semibold" data-numeric>{m.value}</p>
                </div>
              );
            })}
          </div>

          <motion.div className="relative z-0" style={reduced ? undefined : { y: chartShift }}>
            {/*
              Смуга смужок водіїв: приклеєна до верхньої межі графіка
              (`bottom-full`), тож їде разом із ним. По горизонталі підрізана
              на `p-5` панелі, щоб слоти збігалися зі стовпчиками.

              Обрізає їх `overflow-hidden` плюс маска — різкий зріз на межі
              рядка карток видно, а плавне згасання читається як «пірнули під
              картки».
            */}
            {stripCount > 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-5 bottom-full overflow-hidden"
                style={{
                  height: DRIVER_LANE_PX,
                  maskImage: 'linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 0.4) 34%, #000 72%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 0.4) 34%, #000 72%)',
                }}
              >
                {strips.slice(0, stripCount).map(strip =>
                  reduced
                    ? <StaticDriverStrip key={strip.id} strip={strip} />
                    : <DriverStrip key={strip.id} strip={strip} progress={scrollProgress} />,
                )}
              </div>
            )}

            {/* Погодинна витрата */}
            <div className="glass-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="micro-label" style={{ color: 'var(--text-muted)' }}>
                  {t('landing.hourlyFuel')}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--warn)' }} data-numeric>
                  {t('landing.peak', {
                    v0: MAX_HOUR_FUEL,
                    v1: pad(FLEET_DAY.findIndex(r => r.fuel === MAX_HOUR_FUEL)),
                  })}
                </span>
              </div>

              <div className="flex h-32 items-end gap-[3px]" role="img"
                aria-label={t('landing.fleetDayChartAria', { v0: pad(shownHour) })}>
                {FLEET_DAY.map(r => {
                  const passed = r.hour <= shownHour;
                  const current = r.hour === shownHour;
                  return (
                    <div
                      key={r.hour}
                      className="flex-1 rounded-t-[3px]"
                      style={{
                        height: `${Math.max(4, (r.fuel / MAX_HOUR_FUEL) * 100)}%`,
                        background: current
                          ? 'var(--warn)'
                          : passed
                            ? 'rgb(var(--warn-rgb) / 0.42)'
                            : 'var(--surface-hover)',
                        boxShadow: current ? '0 0 14px rgb(var(--warn-rgb) / 0.5)' : 'none',
                        transition: 'background 220ms var(--ease-state), box-shadow 220ms var(--ease-state)',
                      }}
                    />
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {SCALE_LABELS.map(l => <span key={l}>{l}:00</span>)}
              </div>
            </div>
          </motion.div>

          <GlowCaption progress={scrollProgress} reduced={reduced} />
        </div>
      </div>
    </section>
  );
}

/**
 * Підпис під графіком: їде донизу з-під панелі, підростає й пропускає крізь
 * себе хвилю підсвітки — літера за літерою, від першої до останньої.
 *
 * Зсув і масштаб узяті в те саме вікно прогресу, що й зсув графіка: якби
 * підпис відставав, панель на середині руху все одно його накривала б.
 *
 * Розмір змінює `scale`, а не `font-size`: другий переверстує абзац на
 * кожному кадрі скролу. Через це в підпису з'явилася й максимальна ширина —
 * рядок на всю колонку, розтягнутий у 1.28 раза, вилазив би за неї.
 */
function GlowCaption({ progress, reduced }: { progress: MotionValue<number>; reduced: boolean }) {
  // Довжина підпису різна в кожній мові, тож розбір іде від перекладеного
  // тексту, а не від константи рівня модуля.
  const captionText = t('landing.fleetDayDisclaimer', { v0: FLEET_SIZE });

  /*
    Текст розбирається на слова, слова — на літери, з наскрізною нумерацією.
    Пробіл теж займає позицію: підсвітка помітно «переступає» з слова на
    слово, замість бігти суцільною стрічкою.
  */
  const words = useMemo(() => {
    let index = 0;
    return captionText.split(' ').map(word => {
      const letters = [...word].map(char => ({ char, index: index++ }));
      index += 1; // пробіл
      return letters;
    });
  }, [captionText]);

  const letterCount = captionText.length;

  const shiftFrom = TRIGGER_PROGRESS;
  const shiftTo = TRIGGER_PROGRESS + CHART_SHIFT_SPAN;

  const y = useTransform(progress, [shiftFrom, shiftTo], [0, CAPTION_SHIFT_PX], { ease: EASE_RISE });
  const scale = useTransform(progress, [shiftFrom, shiftTo], [1, CAPTION_SCALE_TO], { ease: EASE_RISE });
  // Хвиля стартує, коли підпис уже став на місце, і закінчується, вийшовши
  // за останню літеру на ширину власної голови — інакше кінець тексту
  // лишався б підсвіченим назавжди.
  const sweep = useTransform(
    progress,
    [shiftTo, shiftTo + CAPTION_SWEEP_SPAN],
    [0, letterCount + CAPTION_GLOW_LETTERS],
  );

  if (reduced) {
    return (
      <p className="mt-4 max-w-xl text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {captionText}
      </p>
    );
  }

  return (
    <motion.p
      className="mt-4 max-w-xl text-[11px] leading-relaxed"
      style={{ color: 'var(--text-muted)', transformOrigin: 'left top', willChange: 'transform', y, scale }}
    >
      {/* Читалкам — суцільний текст: посимвольна розмітка нижче декоративна. */}
      <span className="sr-only">{captionText}</span>
      <span aria-hidden>
        {words.map((letters, w) => (
          <React.Fragment key={w}>
            {w > 0 && ' '}
            <span className="inline-block whitespace-pre">
              {letters.map(l => <GlowLetter key={l.index} char={l.char} index={l.index} sweep={sweep} />)}
            </span>
          </React.Fragment>
        ))}
      </span>
    </motion.p>
  );
}

/**
 * Літера з накладеним світлом.
 *
 * Сама літера не змінюється — над нею лежить її ж копія у кольорі акценту, і
 * рухається тільки її `opacity`. Через це підсвітка нічого не переверстовує й
 * не перефарбовує базовий текст, а хвиля має плавні обидва схили: `sin²`
 * піднімає світло й так само рівно його гасить.
 */
function GlowLetter(
  { char, index, sweep }: { char: string; index: number; sweep: MotionValue<number> },
) {
  const opacity = useTransform(sweep, v => {
    const d = v - index;
    if (d <= 0 || d >= CAPTION_GLOW_LETTERS) return 0;
    return Math.sin((d / CAPTION_GLOW_LETTERS) * Math.PI) ** 2;
  });

  return (
    <span className="relative inline-block">
      {char}
      <motion.span
        className="pointer-events-none absolute inset-0"
        style={{
          color: 'var(--warn)',
          textShadow: '0 0 12px rgb(var(--warn-rgb) / 0.75)',
          willChange: 'opacity',
          opacity,
        }}
      >
        {char}
      </motion.span>
    </span>
  );
}

/**
 * Одна смужка водія.
 *
 * Власного часу в неї немає: `local` — це той самий прогрес секції, лише
 * перерахований у власне вікно смужки. Тому прокрутка назад втягує смужку
 * рівно тим шляхом, яким вона піднімалася.
 *
 * Рухаються тільки `transform` і `opacity` — жодного `top`, щоб десяток
 * смужок не тягнув за собою перерахунок розкладки на кожному кадрі.
 */
function DriverStrip({ strip, progress }: { strip: DriverStripParams; progress: MotionValue<number> }) {
  const local = useTransform(progress, [strip.start, strip.end], [0, 1], { ease: EASE_RISE });
  // 0 — смужка цілком під нижньою межею смуги, 1 — цілком над верхньою.
  const y = useTransform(local, v => strip.height - v * (DRIVER_LANE_PX + strip.height));
  const x = useTransform(local, v => Math.sin(v * Math.PI * strip.wobble + strip.phase) * strip.jitter);
  const opacity = useTransform(local, [0, 0.08, 0.62, 1], [0, 1, 1, 0]);

  return (
    <motion.span
      className="absolute bottom-0 block rounded-full"
      style={{
        left: `${strip.left}%`,
        width: DRIVER_STRIP_WIDTH_PX,
        height: strip.height,
        marginLeft: -DRIVER_STRIP_WIDTH_PX / 2,
        background: `linear-gradient(to bottom, rgb(var(${strip.tone}) / 0.92), rgb(var(${strip.tone}) / 0.22))`,
        boxShadow: `0 0 10px rgb(var(${strip.tone}) / 0.35)`,
        willChange: 'transform, opacity',
        x,
        y,
        opacity,
      }}
    />
  );
}

/**
 * Той самий шар для `prefers-reduced-motion`: смужки просто проявляються біля
 * верхньої межі графіка — без польоту, гуляння й прив'язки до скролу.
 *
 * Поява зроблена засобами framer-motion, а не класом `.rise`: глобальне
 * правило в globals.css обрізає CSS-анімації до 0.01ms, тож там від згасання
 * лишилося б миттєве вмикання.
 */
function StaticDriverStrip({ strip }: { strip: DriverStripParams }) {
  return (
    <motion.span
      className="absolute bottom-0 block rounded-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: Math.min(strip.id * 0.02, 0.5), ease: EASE_ENTER }}
      style={{
        left: `${strip.left}%`,
        width: DRIVER_STRIP_WIDTH_PX,
        height: strip.height,
        marginLeft: -DRIVER_STRIP_WIDTH_PX / 2,
        background: `linear-gradient(to bottom, rgb(var(${strip.tone}) / 0.92), rgb(var(${strip.tone}) / 0.22))`,
      }}
    />
  );
}
