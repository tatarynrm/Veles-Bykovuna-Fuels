'use client';

import React, { useRef } from 'react';
import { ArrowRight, Check, Clock } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useGsap } from '@/shared/lib/useGsap';
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion';
import {
  COST_LINES, DATA_SOURCES, RESULT_ROWS, TONE_VAR, TONE_SOFT,
  type CostLine, type DataSource,
} from '@/shared/config/expenses';
import { usePlayInView } from '../model/usePlayInView';

/**
 * Скільки висоти сторінки «коштує» сцена. Чотири з половиною екрани — це
 * приблизно секунда на кожен рядок витрат у спокійному темпі скролу; менше —
 * і підписи не встигають прочитатися, більше — і починає здаватися, що
 * сторінка зависла.
 */
const SCENE_VH = 460;

/** Умовна тривалість таймлайна. Scrub розтягує її на всю висоту секції. */
const SPAN = 10;
/** Момент, коли фура розвертається: кінець першої половини сцени. */
const TURN = 4.7;

const LIVE_COUNT = COST_LINES.filter(line => line.status === 'live').length;

/* ── дрібні спільні шматки: однакові в рухомій і статичній версії ──────── */

function StatusChip({ status }: { status: CostLine['status'] }) {
  const live = status === 'live';
  return (
    <span
      className={`badge ${live ? 'badge-success' : 'badge-neutral'} flex-none gap-1`}
      title={t(live ? 'landing.exp.statusLive' : 'landing.exp.statusPlanned')}
    >
      {live ? <Check size={11} /> : <Clock size={11} />}
      <span className="hidden sm:inline">
        {t(live ? 'landing.exp.statusLive' : 'landing.exp.statusPlanned')}
      </span>
    </span>
  );
}

function CostRow({ line }: { line: CostLine }) {
  const Icon = line.icon;
  return (
    <li data-cost className="glass-inset flex items-center gap-3 p-2.5 sm:p-3">
      <span
        className="flex h-8 w-8 flex-none items-center justify-center rounded-xl sm:h-9 sm:w-9"
        style={{ background: TONE_SOFT[line.tone], color: TONE_VAR[line.tone] }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{t(line.title)}</p>
        <p
          className="mt-1 hidden text-[11px] leading-snug sm:block"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t(line.detail)}
        </p>
      </div>
      <StatusChip status={line.status} />
    </li>
  );
}

function SourceRow({ source }: { source: DataSource }) {
  const Icon = source.icon;
  return (
    <li data-source className="glass-inset flex items-center gap-3 p-2.5 sm:p-3">
      <span
        className="flex h-8 w-8 flex-none items-center justify-center rounded-xl sm:h-9 sm:w-9"
        style={{ background: TONE_SOFT[source.tone], color: TONE_VAR[source.tone] }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{t(source.title)}</p>
        <p
          className="mt-1 hidden text-[11px] leading-snug sm:block"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t(source.detail)}
        </p>
      </div>
      <ArrowRight size={14} className="flex-none" style={{ color: 'var(--text-muted)' }} />
    </li>
  );
}

/**
 * Частка рядків, під якими вже є живе джерело. Число рахується з масиву, а не
 * вписане в текст: додасться інтеграція — кільце зміниться саме.
 */
function LiveShare() {
  const total = COST_LINES.length;
  const ratio = LIVE_COUNT / total;
  const circumference = 2 * Math.PI * 26;

  return (
    <div className="glass-inset flex items-center gap-4 p-4">
      <svg width="64" height="64" viewBox="0 0 64 64" className="flex-none" aria-hidden>
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r="26" fill="none"
          stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="min-w-0">
        <p className="font-display text-lg leading-none" data-numeric>
          {LIVE_COUNT} / {COST_LINES.length}
        </p>
        <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          {t('landing.exp.liveShareNote')}
        </p>
      </div>
    </div>
  );
}

function ResultCard() {
  return (
    <div data-result className="glass-inset p-4">
      <p className="micro-label mb-3" style={{ color: 'var(--accent)' }}>
        {t('landing.exp.resultTitle')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {RESULT_ROWS.map(row => (
          <div key={row.id}>
            <p className="text-[10px] leading-none" style={{ color: 'var(--text-muted)' }}>
              {t(row.label)}
            </p>
            <p className="mt-1.5 text-sm font-semibold" data-numeric>{row.value}</p>
          </div>
        ))}
      </div>
      {/*
        На вузькому екрані ця виноска — перше, що можна віддати: у закріпленій
        сцені висота фіксована, і саме тут вміст починав вилазити за екран.
      */}
      <p
        className="mt-4 hidden text-[11px] leading-snug sm:block"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('landing.exp.resultNote')}
      </p>
    </div>
  );
}

function PhaseHeading({ eyebrow, title, lead, tone }: {
  eyebrow: string; title: string; lead: string; tone: string;
}) {
  return (
    <div className="mb-4 max-w-xl sm:mb-5">
      <p className="micro-label mb-2" style={{ color: tone }}>{t(eyebrow)}</p>
      <h2 className="font-display text-[22px] leading-[1.12] sm:text-[28px] lg:text-[32px]">
        {t(title)}
      </h2>
      <p
        className="mt-2.5 text-xs leading-relaxed sm:mt-3 sm:text-[13px]"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t(lead)}
      </p>
    </div>
  );
}

/* ── сама сцена ───────────────────────────────────────────────────────── */

/**
 * Центральна сцена сторінки: два ролики одного кадру, знятих у різні боки.
 *
 * Рейс туди (`to-right`) — витрати: гроші їдуть із компанії. На розвороті
 * кадр змінюється на `to-left`, і назад повертаються не папірці, а рядки
 * даних, які зводяться в один звіт.
 *
 * Закріплення робить CSS `position: sticky`, а не `ScrollTrigger.pin`: пін
 * кешує межі на момент створення, а тригери тут народжуються після
 * динамічного імпорту GSAP — тобто вже після 'load', коли автооновлення їм
 * не дістається, і закріплення зʼїжджає рівно на висоту шрифтів, які
 * доверсталися пізніше.
 *
 * Ролики не скрабляться по currentTime, а програються циклом: кліпи
 * десятисекундні, і розтягнути їх на чотири екрани скролу означає рухати
 * відео по кадру на кожні кілька пікселів — між ключовими кадрами це
 * розсипається на ривки. Замість цього скрол веде камеру: паралакс, масштаб
 * і перехід між кадрами.
 *
 * При `prefers-reduced-motion` сцена малюється зовсім іншою розміткою —
 * звичайною, нерухомою, з обома половинами одразу. Просто вимкнути анімацію
 * тут не можна: без неї закріплена секція на 460vh перетворилась би на
 * чотири екрани порожнечі.
 */
export default function TripScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const staticRef = useRef<HTMLElement>(null);
  const outWrapRef = useRef<HTMLDivElement>(null);
  const inWrapRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  usePlayInView(reduced ? staticRef : sectionRef);

  useGsap(
    ({ gsap }) => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.5,
        },
      });

      tl.fromTo('[data-scene-progress]', { scaleX: 0 }, { scaleX: 1, duration: SPAN }, 0);

      /* Перша половина: фура їде вправо, кадр повільно наїжджає. */
      tl.fromTo(
        outWrapRef.current,
        { xPercent: 5, scale: 1.06 },
        { xPercent: -5, scale: 1.16, duration: TURN + 0.6 },
        0,
      );
      tl.from('[data-phase-out] [data-cost]', {
        autoAlpha: 0, x: -32, duration: 0.7, stagger: 0.6,
      }, 0.4);
      tl.from('[data-phase-out] [data-live-share]', { autoAlpha: 0, y: 24, duration: 0.7 }, 3.4);

      /* Розворот: кадр змінюється, разом із ним — уся половина екрана. */
      tl.to('[data-phase-out]', { autoAlpha: 0, y: -28, duration: 0.6 }, TURN - 0.3);
      tl.to(outWrapRef.current, { autoAlpha: 0, duration: 0.8 }, TURN - 0.1);
      tl.fromTo(inWrapRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, TURN - 0.1);

      /* Друга половина: кадр їде в інший бік — і дані повертаються. */
      tl.fromTo(
        inWrapRef.current,
        { xPercent: -5, scale: 1.16 },
        { xPercent: 5, scale: 1.06, duration: SPAN - TURN },
        TURN,
      );
      tl.fromTo('[data-phase-in]',
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 0.6 },
        TURN + 0.4,
      );
      tl.from('[data-phase-in] [data-source]', {
        autoAlpha: 0, x: 32, duration: 0.7, stagger: 0.55,
      }, TURN + 0.7);
      tl.from('[data-phase-in] [data-result]', {
        autoAlpha: 0, y: 32, scale: 0.96, duration: 0.9,
      }, TURN + 3.1);
    },
    sectionRef,
    [reduced],
  );

  /* Нерухома версія: та сама історія, розказана без скролу. */
  if (reduced) {
    return (
      <section ref={staticRef} className="px-5 py-24 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <div className="mb-5 overflow-hidden rounded-card">
              <video
                src="/videos/truck-scheme-to-right.mp4"
                autoPlay muted loop playsInline preload="metadata" aria-hidden
                className="h-40 w-full object-cover"
              />
            </div>
            <PhaseHeading
              eyebrow="landing.exp.sceneOutEyebrow"
              title="landing.exp.sceneOutTitle"
              lead="landing.exp.sceneOutLead"
              tone="var(--accent)"
            />
            <ul className="mb-4 space-y-2">
              {COST_LINES.map(line => <CostRow key={line.id} line={line} />)}
            </ul>
            <LiveShare />
          </div>

          <div>
            <div className="mb-5 overflow-hidden rounded-card">
              <video
                src="/videos/truck-scheme-to-left.mp4"
                autoPlay muted loop playsInline preload="metadata" aria-hidden
                className="h-40 w-full object-cover"
              />
            </div>
            <PhaseHeading
              eyebrow="landing.exp.sceneInEyebrow"
              title="landing.exp.sceneInTitle"
              lead="landing.exp.sceneInLead"
              tone="var(--warn)"
            />
            <ul className="mb-4 space-y-2">
              {DATA_SOURCES.map(source => <SourceRow key={source.id} source={source} />)}
            </ul>
            <ResultCard />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative" style={{ height: `${SCENE_VH}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Кадр «туди» */}
        <div ref={outWrapRef} className="absolute inset-0" style={{ willChange: 'transform' }}>
          <video
            src="/videos/truck-scheme-to-right.mp4"
            autoPlay muted loop playsInline preload="auto" aria-hidden
            className="h-full w-full object-cover"
            style={{ filter: 'var(--scheme-video-filter)' }}
          />
        </div>

        {/* Кадр «назад» — до розвороту прихований */}
        <div
          ref={inWrapRef}
          className="absolute inset-0"
          style={{ willChange: 'transform', opacity: 0, visibility: 'hidden' }}
        >
          <video
            src="/videos/truck-scheme-to-left.mp4"
            autoPlay muted loop playsInline preload="auto" aria-hidden
            className="h-full w-full object-cover"
            style={{ filter: 'var(--scheme-video-filter)' }}
          />
        </div>

        <div className="absolute inset-0" style={{ background: 'var(--scheme-scrim)' }} />
        <div
          className="absolute inset-x-0 bottom-0 h-48"
          style={{ background: 'var(--scheme-fade)' }}
        />

        {/* Прогрес сцени */}
        <div
          className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: 'var(--border-subtle)' }}
          aria-hidden
        >
          <span
            data-scene-progress
            className="block h-full origin-left"
            style={{ background: 'var(--accent)', transform: 'scaleX(0)' }}
          />
        </div>

        {/*
          Обидві половини лежать в одній клітинці ґрід-сітки й перекривають одна
          одну: так перехід — це просто кросфейд, без стрибка висоти. Прихована
          половина не ловить кліки, бо GSAP гасить її через autoAlpha, а це і
          visibility, а не лише opacity.
        */}
        {/*
          Відступи на телефоні менші не задля щільності: висота сцени тут
          дорівнює екрану й не росте за вмістом, тож усе, що не влізло,
          просто обрізається. Друга половина (джерела + картка звіту) —
          найвища, вона і визначає цю межу.
        */}
        <div className="relative z-10 mx-auto flex h-full max-w-6xl items-center px-5 py-12 sm:px-8 sm:py-24">
          <div className="grid w-full" style={{ gridTemplateAreas: '"stack"' }}>
            <div data-phase-out style={{ gridArea: 'stack' }}>
              <PhaseHeading
                eyebrow="landing.exp.sceneOutEyebrow"
                title="landing.exp.sceneOutTitle"
                lead="landing.exp.sceneOutLead"
                tone="var(--accent)"
              />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <ul className="space-y-2">
                  {COST_LINES.map(line => <CostRow key={line.id} line={line} />)}
                </ul>
                <div data-live-share className="hidden lg:block">
                  <LiveShare />
                </div>
              </div>
            </div>

            <div
              data-phase-in
              style={{ gridArea: 'stack', opacity: 0, visibility: 'hidden' }}
            >
              <PhaseHeading
                eyebrow="landing.exp.sceneInEyebrow"
                title="landing.exp.sceneInTitle"
                lead="landing.exp.sceneInLead"
                tone="var(--warn)"
              />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <ul className="space-y-2">
                  {DATA_SOURCES.map(source => <SourceRow key={source.id} source={source} />)}
                </ul>
                <ResultCard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
