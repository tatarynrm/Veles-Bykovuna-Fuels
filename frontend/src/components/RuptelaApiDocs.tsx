'use client';

/**
 * Документація інтеграції Ruptela (FMS Insights REST + Routing & Tasking GraphQL + Delphi)
 * як модальне вікно. Презентаційний рушій (картки методів, VERB-бейджі, копіювання, пошук,
 * нотатки) спільний з VendorApiDocs.tsx — він у `@/shared/ui/api-reference`. Тут лишається
 * вміст вкладок телематики з амбер-акцентом (`accent="warn"`) та сама оболонка-модалка.
 *
 * Технічний довідник для розробника — у списку i18n EXCLUDE (авторський текст не перекладається).
 */

import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, X, AlertTriangle, Code2, Server, Route } from 'lucide-react';
import {
  INSIGHTS_GROUPS,
  TRANSPORT_NOTES,
  GQL_OPERATIONS,
  GQL_ENDPOINT,
  GQL_TRANSPORT,
  GQL_ERROR_SHAPE,
  WAYPOINT_TYPES_LIST,
  TRIP_STATES_LIST,
  DELPHI_SNIPPETS,
  DELPHI_PITFALLS,
} from '@/shared/config/ruptelaApiDocs';
import { API_BASE } from '@/lib/api';
import { Code, Note, SectionTitle, MethodExplorer } from '@/shared/ui/api-reference';

type Tab = 'overview' | 'rest' | 'graphql' | 'delphi';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Огляд' },
  { id: 'rest', label: 'FMS Insights · REST' },
  { id: 'graphql', label: 'Routing & Tasking · GraphQL' },
  { id: 'delphi', label: 'Delphi' },
];

/* ── вміст вкладок ─────────────────────────────────────────────────────── */

function OverviewTab() {
  return (
    <div className="space-y-5">
      <SectionTitle
        icon={Server}
        accent="warn"
        title="Два різні API під одним ключем"
        subtitle="Ruptela віддає телематику через REST, а планування рейсів — через GraphQL. Ключ RUPTELA_API_KEY один і той самий."
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="glass-inset space-y-2 rounded-card p-4">
          <span className="badge badge-info">REST</span>
          <p className="font-mono text-2xs text-txt-primary">https://api.fm-track.com/&lt;ресурс&gt;</p>
          <p className="text-2xs leading-relaxed text-txt-muted">
            FMS Insights: звіти, реєстри, тахограф. Автентифікація — <code>?api_key=</code>, версія
            ресурсу — <code>?version=</code>. Наш шлюз проксіює це під{' '}
            <code>/api/ruptela/insights/*</code>.
          </p>
        </div>
        <div className="glass-inset space-y-2 rounded-card p-4">
          <span className="badge badge-warn">GraphQL</span>
          <p className="font-mono text-2xs text-txt-primary">{GQL_ENDPOINT}</p>
          <p className="text-2xs leading-relaxed text-txt-muted">
            Routing &amp; Tasking: поїздки, маршрути, завдання водію. Один URL, операція — у тілі.
            Наш шлюз проксіює це під <code>/api/ruptela/trips</code>.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <span className="micro-label">Ланцюг виклику</span>
        <Code
          title="потік даних"
          code={`Delphi / браузер
   │  Authorization: Bearer veles_session_<мс>_<РОЛЬ>
   ▼
${API_BASE}/api/ruptela/insights/...      ← наш NestJS-шлюз
   │  додає ?api_key=… та ?version=…, кешує реєстри, нормалізує відповідь
   ▼
https://api.fm-track.com/...              ← Ruptela FMS`}
        />
      </div>

      <div className="space-y-2">
        <span className="micro-label">Правила, що діють для всіх методів</span>
        <div className="grid gap-2 md:grid-cols-2">
          {TRANSPORT_NOTES.map((n) => (
            <div key={n.title} className="glass-inset rounded-card p-3">
              <p className="text-2xs font-semibold text-txt-primary">{n.title}</p>
              <p className="mt-1 text-2xs leading-relaxed text-txt-muted">{n.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RestTab() {
  return (
    <MethodExplorer
      groups={INSIGHTS_GROUPS}
      searchPlaceholder="Пошук за методом, шляхом або ендпоінтом Ruptela…"
      upstreamTitle="upstream · api.fm-track.com"
    />
  );
}

function GraphqlTab() {
  const [active, setActive] = useState(GQL_OPERATIONS[0].id);
  const op = GQL_OPERATIONS.find((o) => o.id === active) ?? GQL_OPERATIONS[0];

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={Route}
        accent="warn"
        title="Routing & Tasking — одна точка входу"
        subtitle="Усі чотири операції йдуть в один і той самий URL методом POST. Відрізняється лише тіло запиту."
      />

      <Code title="транспорт" code={GQL_TRANSPORT} />

      <Note tone="warn">
        <b>Найважливіше:</b> GraphQL відповідає <b>HTTP 200 навіть на провалену операцію</b> — помилка
        лежить у масиві <code>errors</code>. Обгортка try/except навколо HTTP-виклику вважатиме
        успішною кожну відхилену мутацію.
      </Note>

      <Code title="як виглядає відмова" code={GQL_ERROR_SHAPE} />

      <div className="segmented flex-wrap">
        {GQL_OPERATIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setActive(o.id)}
            className={`segmented-item ${active === o.id ? 'segmented-item-active' : ''}`}
          >
            {o.kind === 'mutation' ? 'mutation ' : 'query '}
            {o.id}
          </button>
        ))}
      </div>

      <div className="glass-inset space-y-4 rounded-card p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${op.kind === 'mutation' ? 'badge-warn' : 'badge-info'}`}>
              {op.kind}
            </span>
            <h4 className="text-sm font-semibold text-txt-primary">{op.title}</h4>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-txt-secondary">{op.summary}</p>
          <p className="mt-2 font-mono text-2xs text-txt-muted">
            Через наш шлюз: <span className="text-txt-primary">{op.proxy}</span>
          </p>
        </div>

        <div className="space-y-2">
          <span className="micro-label">GraphQL-документ</span>
          <Code title="query" code={op.document} />
        </div>

        <div className="space-y-2">
          <span className="micro-label">Змінні</span>
          <Code title="variables" code={op.variables} />
        </div>

        <div className="space-y-2">
          <span className="micro-label">Відповідь</span>
          <Code title="response" code={op.result} />
        </div>

        <div className="space-y-2">
          <span className="micro-label">Правила, які валять мутацію</span>
          <div className="space-y-1.5">
            {op.rules.map((r, i) => (
              <Note key={i} tone="warn">
                {r}
              </Note>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="micro-label">Delphi</span>
          <Code title="Delphi · Pascal" code={op.delphi} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="glass-inset space-y-2 rounded-card p-4">
          <span className="micro-label">Типи точок маршруту (WaypointType)</span>
          <div className="flex flex-wrap gap-1.5">
            {WAYPOINT_TYPES_LIST.map((t) => (
              <span key={t} className="badge badge-neutral font-mono">
                {t}
              </span>
            ))}
          </div>
          <p className="text-2xs leading-relaxed text-txt-muted">
            <code>cargoWeight</code> приймається лише на <code>LOADING</code> та{' '}
            <code>UNLOADING</code>.
          </p>
        </div>
        <div className="glass-inset space-y-2 rounded-card p-4">
          <span className="micro-label">Стани поїздки (TripState)</span>
          <div className="flex flex-wrap gap-1.5">
            {TRIP_STATES_LIST.map((s) => (
              <span
                key={s.state}
                className={`badge font-mono ${s.scope === 'архів' ? 'badge-neutral' : 'badge-success'}`}
              >
                {s.state}
              </span>
            ))}
          </div>
          <p className="text-2xs leading-relaxed text-txt-muted">
            Зелені — «активні»: саме їх запитує шлюз за замовчуванням (4 с). Сірі — архів, повний
            запит по них коштує ~31 с.
          </p>
        </div>
      </div>
    </div>
  );
}

function DelphiTab() {
  return (
    <div className="space-y-5">
      <SectionTitle
        icon={Code2}
        accent="warn"
        title="Delphi-клієнт"
        subtitle="System.Net.HttpClient + System.JSON. Дві базові функції — RuptelaGraphQL() для рейсів і FmsGet() для звітів — покривають усі методи вище."
      />

      <div className="space-y-2">
        <span className="micro-label">Типові помилки інтеграції</span>
        <div className="grid gap-2 md:grid-cols-2">
          {DELPHI_PITFALLS.map((p) => (
            <div key={p.title} className="glass-inset rounded-card p-3">
              <p className="flex items-center gap-1.5 text-2xs font-semibold text-txt-primary">
                <AlertTriangle className="h-3 w-3 text-warn" />
                {p.title}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-txt-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </div>

      {DELPHI_SNIPPETS.map((s) => (
        <section key={s.id} className="space-y-2">
          <h4 className="text-sm font-semibold text-txt-primary">{s.title}</h4>
          <p className="text-2xs leading-relaxed text-txt-muted">{s.intro}</p>
          <Code title="Delphi · Pascal" code={s.code} />
          {s.notes?.map((n, i) => (
            <Note key={i}>{n}</Note>
          ))}
        </section>
      ))}
    </div>
  );
}

/* ── саме вікно ────────────────────────────────────────────────────────── */

export default function RuptelaApiDocs({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const bodyRef = useRef<HTMLDivElement>(null);

  // Без цього перехід на вкладку зберігає прокрутку попередньої і відкривається «з середини».
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Документація Ruptela FMS Insights"
    >
      <div
        className="glass-float animate-pop flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hairline-b flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-warn/10 text-warn">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">
                Ruptela FMS Insights — документація інтеграції
              </h3>
              <p className="mt-0.5 text-2xs text-txt-muted">
                Куди шлюз пересилає кожен запит, у якому форматі, і як сформувати те саме з Delphi
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon h-8 w-8 shrink-0" aria-label="Закрити">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="hairline-b px-5 py-3 sm:px-6">
          <div className="segmented flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`segmented-item ${tab === t.id ? 'segmented-item-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'rest' && <RestTab />}
          {tab === 'graphql' && <GraphqlTab />}
          {tab === 'delphi' && <DelphiTab />}
        </div>
      </div>
    </div>
  );
}
