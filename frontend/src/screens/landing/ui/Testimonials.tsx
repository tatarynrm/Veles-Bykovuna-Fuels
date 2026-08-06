'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Star } from 'lucide-react';
import SectionHeading from '@/shared/ui/SectionHeading';
import { useSectionSound } from '@/features/sound';
import { t } from '@/lib/i18n';

/**
 * Стіна відгуків: чотири вертикальні стрічки, розвернуті в перспективі.
 *
 * Чому саме так, а не сітка карток. Відгуків має бути видно багато — це і є
 * повідомлення. Сітка з дев'яти карток займає екран і читається як робота,
 * а нахилена стіна, що повільно їде, читається як «їх тут ще стільки ж за
 * кадром». Обертання й перспектива зроблені CSS-трансформом на обгортці, тож
 * самі картки лишаються звичайним потоком і не потребують 3D-рушія.
 *
 * Далі секція розгортається у два акценти: фраза, що проявляється по словах
 * під час прокрутки, і лічильник, який за пару секунд пробігає від 1 % до
 * 10^19 %. Число навмисно абсурдне — це жарт, а не показник; підпис під ним
 * це проговорює, щоб воно не читалось як обіцянка.
 */

/*
  УВАГА: це ДЕМОНСТРАЦІЙНІ відгуки — імена й цитати вигадані для верстки.
  Перед публікацією їх треба замінити на справжні (з дозволом людей, чиї
  імена стоять під цитатами). Тексти лежать у словниках за ключами
  landing.rev.*, тож заміна не чіпає код.

  Імена — власні, вони однакові в усіх мовах.
  i18n-ignore-props: name
*/
const REVIEWS = [
  { name: 'Андрій Ткачук',   role: 'landing.rev.tkachukRole',   body: 'landing.rev.tkachukBody',   tone: 'var(--accent)' },
  { name: 'Оксана Мельник',  role: 'landing.rev.melnykRole',    body: 'landing.rev.melnykBody',    tone: 'var(--info)' },
  { name: 'Ігор Савчук',     role: 'landing.rev.savchukRole',   body: 'landing.rev.savchukBody',   tone: 'var(--warn)' },
  { name: 'Марія Ковальчук', role: 'landing.rev.kovalchukRole', body: 'landing.rev.kovalchukBody', tone: 'var(--accent)' },
  { name: 'Василь Гнатюк',   role: 'landing.rev.hnatiukRole',   body: 'landing.rev.hnatiukBody',   tone: 'var(--warn)' },
  { name: 'Наталя Романюк',  role: 'landing.rev.romaniukRole',  body: 'landing.rev.romaniukBody',  tone: 'var(--info)' },
  { name: 'Петро Гринчук',   role: 'landing.rev.hrynchukRole',  body: 'landing.rev.hrynchukBody',  tone: 'var(--accent)' },
  { name: 'Юлія Бондар',     role: 'landing.rev.bondarRole',    body: 'landing.rev.bondarBody',    tone: 'var(--info)' },
  { name: 'Дмитро Лисенко',  role: 'landing.rev.lysenkoRole',   body: 'landing.rev.lysenkoBody',   tone: 'var(--warn)' },
] as const;

type Review = (typeof REVIEWS)[number];

/** Ініціали замість фото: жодного запиту на чужий хост заради аватарки. */
const initials = (name: string) =>
  name.split(' ').map(part => part[0]).join('').slice(0, 2);

function Stars() {
  return (
    <div className="mt-2.5 flex gap-0.5" role="img" aria-label={t('landing.rev.stars')}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="h-3 w-3" style={{ fill: 'var(--warn)', color: 'var(--warn)' }} />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="glass-inset w-[248px] rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: 'var(--surface-hover)', color: review.tone }}
          aria-hidden
        >
          {initials(review.name)}
        </span>
        <div className="min-w-0">
          <figcaption className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {review.name}
          </figcaption>
          <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t(review.role)}
          </p>
        </div>
      </div>

      <Stars />

      <blockquote className="mt-2.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {t(review.body)}
      </blockquote>
    </figure>
  );
}

/**
 * Колонка стрічки. Список дублюється всередині одного треку — саме на цьому
 * тримається безшовність зсуву на -50 % (див. `.marquee-v` у globals.css).
 * Дубль прихований від асистивних технологій, щоб скрінрідер не зачитав
 * ті самі відгуки двічі.
 */
function Column({
  items,
  speed,
  reverse = false,
}: {
  items: readonly Review[];
  speed: number;
  reverse?: boolean;
}) {
  const style = {
    '--marquee-duration': `${speed}s`,
    '--marquee-direction': reverse ? 'reverse' : 'normal',
  } as React.CSSProperties;

  return (
    <div className="marquee-v marquee-v-pause h-full" style={style}>
      <div className="marquee-v-track">
        {[...items, ...items].map((review, i) => (
          <div key={i} className="pb-4" aria-hidden={i >= items.length}>
            <ReviewCard review={review} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Кожна колонка стартує з іншого місця списку — інакше стіна йде рядами. */
const rotate = (offset: number) => [...REVIEWS.slice(offset), ...REVIEWS.slice(0, offset)];

const COLUMNS = [
  { items: rotate(0), speed: 52, reverse: false, hideBelow: '' },
  { items: rotate(3), speed: 64, reverse: true,  hideBelow: '' },
  { items: rotate(6), speed: 58, reverse: false, hideBelow: 'hidden sm:block' },
  { items: rotate(2), speed: 70, reverse: true,  hideBelow: 'hidden lg:block' },
];

function Wall() {
  return (
    <div
      className="relative h-[440px] overflow-hidden sm:h-[520px]"
      style={{ perspective: '340px' }}
    >
      {/*
        Обгортка навмисно більша за контейнер (inset -18%): нахилена площина
        інакше показує власні краї — знизу видно, де закінчуються колонки.
      */}
      <div
        className="absolute inset-[-18%] flex justify-center gap-4"
        style={{
          transform:
            'translateX(-24px) translateY(-8px) translateZ(-70px) rotateX(14deg) rotateY(-10deg) rotateZ(12deg)',
        }}
      >
        {COLUMNS.map((col, i) => (
          <div key={i} className={col.hideBelow}>
            <Column items={col.items} speed={col.speed} reverse={col.reverse} />
          </div>
        ))}
      </div>

      {/* Розчинення по краях: стіна має танути, а не обриватись по рамці. */}
      {[
        'inset-x-0 top-0 h-1/4 bg-gradient-to-b',
        'inset-x-0 bottom-0 h-1/4 bg-gradient-to-t',
        'inset-y-0 left-0 w-1/5 bg-gradient-to-r',
        'inset-y-0 right-0 w-1/5 bg-gradient-to-l',
      ].map(cls => (
        <div
          key={cls}
          aria-hidden
          className={`pointer-events-none absolute ${cls}`}
          style={{ ['--tw-gradient-from' as string]: 'var(--bg-page)', ['--tw-gradient-stops' as string]: 'var(--bg-page), transparent' }}
        />
      ))}
    </div>
  );
}

/** Одне слово фрази — яскравість веде прокрутка, а не таймер. */
function Word({
  word,
  progress,
  range,
}: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return <motion.span style={{ opacity }}>{word}</motion.span>;
}

/**
 * Фраза, що проявляється по словах під час прокрутки.
 *
 * Слова беруться розбиттям перекладеного рядка по пробілах, а не окремими
 * ключами: у кожної мови свій порядок і своя кількість слів, а розбиття
 * працює скрізь однаково.
 */
function ScrollPromise() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.92', 'start 0.35'],
  });

  const words = t('landing.rev.promise').split(' ');

  return (
    <p
      ref={ref}
      className="font-display mx-auto mt-24 flex max-w-3xl flex-wrap justify-center gap-x-3 gap-y-1 text-center text-[26px] leading-[1.15] sm:text-[40px]"
    >
      {words.map((word, i) => (
        <Word
          key={`${word}-${i}`}
          word={word}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1) / words.length]}
        />
      ))}
    </p>
  );
}

/** 10^19 — те саме число, що в підписі; тримаємо його BigInt, щоб не втратити цифри. */
const TARGET_POWER = 19;
const TARGET = '1' + '0'.repeat(TARGET_POWER);
const RUN_MS = 2600;

/**
 * Число заданого порядку — рядком, а не числом.
 *
 * `Number` тримає цілі точно лише до 2^53 (~9·10^15), а дійти треба до 10^19.
 * Тому старші 15 значущих цифр рахуються в double, а решта дописується
 * нулями: для біжучого лічильника цього досить, і цифри не перетворюються
 * на сміття на кшталт 9999999999999998. BigInt тут не годиться — проєкт
 * компілюється в ES2017, де немає ні літералів `10n`, ні самого типу.
 */
function powerString(exponent: number): string {
  const whole = Math.floor(exponent);
  const mantissa = Math.pow(10, exponent - whole);
  if (whole < 15) return String(Math.round(mantissa * Math.pow(10, whole)));

  let head = String(Math.round(mantissa * 1e14));
  // Мантиса могла округлитись до 10 — тоді голова на цифру довша, ніж треба.
  if (head.length > 15) head = head.slice(0, 15);
  return head + '0'.repeat(whole - 14);
}

/**
 * Розряди відділяються вузьким нерозривним пробілом: 20 цифр поспіль не
 * читаються взагалі, а звичайний пробіл дозволив би перенос усередині числа.
 */
const group = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Лічильник від 1 % до 10^19 %.
 *
 * Шкала логарифмічна: лінійна майже весь час показувала б нулі й лише в
 * останні міліметри дороги оживала. Тут же око встигає побачити, як число
 * проходить десятки, тисячі, мільйони й далі — саме цей пробіг і є ефектом.
 *
 * Значення пишеться прямо в DOM повз стан React: ~150 кадрів анімації — це
 * 150 зайвих рендерів секції, а міняється в ній один текстовий вузол.
 */
function BillionCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20%' });

  useEffect(() => {
    if (!inView) return;
    const node = valueRef.current;
    if (!node) return;

    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (calm) {
      node.textContent = group(TARGET);
      return;
    }

    let raf = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / RUN_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      // На фініші беремо саме TARGET: 10^19 через double дало б «майже» те число.
      node.textContent =
        p >= 1 ? group(TARGET) : group(powerString(eased * TARGET_POWER));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  return (
    <div ref={ref} className="mt-10 text-center">
      <p
        className="tabular font-display whitespace-nowrap font-bold leading-none"
        style={{
          fontSize: 'clamp(20px, 4.6vw, 52px)',
          color: 'var(--accent)',
          textShadow: '0 0 32px rgb(var(--accent-rgb) / 0.35)',
        }}
      >
        <span ref={valueRef}>1</span>
        <span style={{ color: 'var(--text-primary)' }}> %</span>
      </p>
      <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {t('landing.rev.counterNote')}
      </p>
    </div>
  );
}

export default function Testimonials() {
  const ref = useSectionSound<HTMLElement>();

  return (
    <section ref={ref} className="overflow-hidden px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow={t('landing.rev.eyebrow')}
          title={t('landing.rev.title')}
          description={t('landing.rev.lead')}
          className="mb-14"
        />

        <Wall />
        <ScrollPromise />
        <BillionCounter />
      </div>
    </section>
  );
}
