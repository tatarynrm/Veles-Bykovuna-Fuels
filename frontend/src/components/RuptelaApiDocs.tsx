'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Copy,
  Check,
  X,
  Search,
  ArrowRight,
  AlertTriangle,
  Code2,
  Server,
  Route,
  Info,
} from 'lucide-react';
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
  type DocMethod,
  type HttpVerb,
} from '@/lib/ruptelaApiDocs';
import { API_BASE } from '@/lib/api';

type Tab = 'overview' | 'rest' | 'graphql' | 'delphi';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Огляд' },
  { id: 'rest', label: 'FMS Insights · REST' },
  { id: 'graphql', label: 'Routing & Tasking · GraphQL' },
  { id: 'delphi', label: 'Delphi' },
];

const VERB_BADGE: Record<HttpVerb, string> = {
  GET: 'badge-info',
  POST: 'badge-success',
  PUT: 'badge-warn',
  PATCH: 'badge-warn',
  DELETE: 'badge-danger',
};

/* ── дрібні блоки ──────────────────────────────────────────────────────── */

function CopyButton({ text, label = 'Копіювати' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button onClick={copy} className="btn btn-ghost h-7 px-2 text-micro" aria-label={label}>
      {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? 'Скопійовано' : label}</span>
    </button>
  );
}

function Code({ title, code }: { title?: string; code: string }) {
  return (
    <div className="glass-inset overflow-hidden">
      <div className="hairline-b flex items-center justify-between gap-3 px-3 py-1.5">
        <span className="font-mono text-micro uppercase tracking-wider text-txt-muted">
          {title ?? 'code'}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="max-h-[420px] overflow-auto p-3 font-mono text-2xs leading-relaxed text-txt-secondary">
        {code}
      </pre>
    </div>
  );
}

function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const Icon = tone === 'warn' ? AlertTriangle : Info;
  return (
    <div
      className={`flex gap-2 rounded-field px-3 py-2 text-2xs leading-relaxed ${
        tone === 'warn' ? 'bg-warn/10 text-txt-secondary' : 'bg-accent/5 text-txt-secondary'
      }`}
    >
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone === 'warn' ? 'text-warn' : 'text-accent'}`} />
      <span>{children}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-warn/10 text-warn">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h4 className="text-sm font-semibold text-txt-primary">{title}</h4>
        {subtitle && <p className="mt-0.5 text-2xs leading-relaxed text-txt-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ── картка одного REST-методу ─────────────────────────────────────────── */

function MethodCard({
  method,
  expanded,
  onToggle,
}: {
  method: DocMethod;
  expanded: boolean;
  onToggle: () => void;
}) {
  const upstreamCurl = `${method.upstream.verb} ${method.upstream.url}`;

  return (
    <div className="glass-inset overflow-hidden rounded-card">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover"
        aria-expanded={expanded}
      >
        <span className={`badge ${VERB_BADGE[method.verb]} shrink-0`}>{method.verb}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-2xs text-txt-primary">{method.path}</span>
          <span className="mt-0.5 block truncate text-2xs text-txt-muted">{method.title}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-txt-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="hairline-t space-y-4 px-4 py-4">
          <p className="text-2xs leading-relaxed text-txt-secondary">{method.summary}</p>

          {/* куди шлюз пересилає запит */}
          <div className="space-y-2">
            <span className="micro-label flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3" />
              Куди йде запит далі
            </span>
            <Code title="upstream · api.fm-track.com" code={upstreamCurl} />
            {method.upstream.note && <Note tone="warn">{method.upstream.note}</Note>}
          </div>

          {method.params && method.params.length > 0 && (
            <div className="space-y-2">
              <span className="micro-label">Параметри</span>
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Параметр</th>
                      <th>Обовʼязковий</th>
                      <th>Опис / відповідник у вендора</th>
                    </tr>
                  </thead>
                  <tbody>
                    {method.params.map((p) => (
                      <tr key={p.name}>
                        <td className="font-mono text-2xs text-txt-primary">{p.name}</td>
                        <td>
                          {p.required ? (
                            <span className="badge badge-warn">так</span>
                          ) : (
                            <span className="text-2xs text-txt-muted">—</span>
                          )}
                        </td>
                        <td className="text-2xs text-txt-secondary">{p.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {method.body && (
            <div className="space-y-2">
              <span className="micro-label">Тіло запиту (JSON)</span>
              <Code title="request body" code={method.body} />
            </div>
          )}

          {method.response && (
            <div className="space-y-2">
              <span className="micro-label">Формат відповіді</span>
              <Code title="response" code={method.response} />
            </div>
          )}

          {method.notes && method.notes.length > 0 && (
            <div className="space-y-1.5">
              {method.notes.map((n, i) => (
                <Note key={i}>{n}</Note>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── вміст вкладок ─────────────────────────────────────────────────────── */

function OverviewTab() {
  return (
    <div className="space-y-5">
      <SectionTitle
        icon={Server}
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
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INSIGHTS_GROUPS;
    return INSIGHTS_GROUPS.map((g) => ({
      ...g,
      methods: g.methods.filter((m) =>
        [m.title, m.path, m.summary, m.upstream.url].some((f) => f.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.methods.length > 0);
  }, [query]);

  const total = groups.reduce((sum, g) => sum + g.methods.length, 0);
  const allIds = groups.flatMap((g) => g.methods.map((m) => m.id));
  const allOpen = allIds.length > 0 && allIds.every((id) => expanded.has(id));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук за методом, шляхом або ендпоінтом Ruptela…"
            className="field pl-9"
          />
        </label>
        <button
          onClick={() => setExpanded(allOpen ? new Set() : new Set(allIds))}
          className="btn btn-ghost h-[42px]"
        >
          {allOpen ? 'Згорнути все' : 'Розгорнути все'}
        </button>
        <span className="badge badge-neutral">
          <span className="tabular">{total}</span>&nbsp;методів
        </span>
      </div>

      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-txt-primary">{group.title}</h4>
            <p className="mt-0.5 text-2xs leading-relaxed text-txt-muted">{group.blurb}</p>
          </div>
          <div className="space-y-2">
            {group.methods.map((m) => (
              <MethodCard
                key={m.id}
                method={m}
                expanded={expanded.has(m.id)}
                onToggle={() => toggle(m.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {total === 0 && (
        <p className="py-8 text-center text-2xs text-txt-muted">Нічого не знайдено за «{query}»</p>
      )}
    </div>
  );
}

function GraphqlTab() {
  const [active, setActive] = useState(GQL_OPERATIONS[0].id);
  const op = GQL_OPERATIONS.find((o) => o.id === active) ?? GQL_OPERATIONS[0];

  return (
    <div className="space-y-5">
      <SectionTitle
        icon={Route}
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
