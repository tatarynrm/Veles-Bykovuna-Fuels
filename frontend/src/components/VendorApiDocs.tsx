'use client';

/**
 * Документація інтеграції паливних вендорів (OKKO + Shell) для сторінки «Документація API».
 *
 * Дзеркалить структуру RuptelaApiDocs.tsx (вкладки, картки методів, VERB-бейджі, копіювання,
 * пошук, нотатки/попередження), але:
 *   • рендериться як повноекранна панель на сторінці, а не модальне вікно;
 *   • використовує продуктовий акцент (emerald), бо це паливний домен, а не телематика.
 *
 * Це технічний довідник для розробника — як і RuptelaApiDocs, він у списку i18n EXCLUDE:
 * український текст тут авторський і не перекладається. Дані (шляхи, поля, JSON) — теж дані вендора.
 */

import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  Copy,
  Check,
  Search,
  ArrowRight,
  AlertTriangle,
  Info,
  Server,
  Fuel,
  Layers,
  ListTree,
  KeyRound,
} from 'lucide-react';
import {
  OKKO_BASE,
  SHELL_BASE,
  OKKO_GROUPS,
  SHELL_GROUPS,
  OKKO_TRANSPORT_NOTES,
  SHELL_TRANSPORT_NOTES,
  OKKO_CARD_STATUS_REF,
  OKKO_TX_TYPES,
  SHELL_CATEGORY_REF,
  type DocGroup,
  type DocMethod,
  type HttpVerb,
} from '@/lib/vendorApiDocs';
import { API_BASE } from '@/lib/api';

type Tab = 'overview' | 'okko' | 'shell';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Огляд' },
  { id: 'okko', label: 'OKKO' },
  { id: 'shell', label: 'Shell' },
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

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h4 className="text-sm font-semibold text-txt-primary">{title}</h4>
        {subtitle && <p className="mt-0.5 text-2xs leading-relaxed text-txt-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ── картка одного методу ──────────────────────────────────────────────── */

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
            <Code title="upstream" code={upstreamCurl} />
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
                      <th>Опис</th>
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

/* ── вендорна вкладка з пошуком ────────────────────────────────────────── */

function VendorTab({
  groups,
  searchPlaceholder,
  children,
}: {
  groups: DocGroup[];
  searchPlaceholder: string;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        methods: g.methods.filter((m) =>
          [m.title, m.path, m.summary, m.upstream.url].some((f) => f.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.methods.length > 0);
  }, [groups, query]);

  const total = filtered.reduce((sum, g) => sum + g.methods.length, 0);
  const allIds = filtered.flatMap((g) => g.methods.map((m) => m.id));
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
            placeholder={searchPlaceholder}
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

      {filtered.map((group) => (
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

      {!query && children}
    </div>
  );
}

/* ── вкладки ───────────────────────────────────────────────────────────── */

function OverviewTab() {
  return (
    <div className="space-y-5">
      <SectionTitle
        icon={Server}
        title="Два вендори під одним шлюзом"
        subtitle="OKKO і Shell мають різні протоколи, автентифікацію та одиниці. Наш NestJS-шлюз нормалізує обидва в одну форму й пагінує крос-вендорні колекції в памʼяті."
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="glass-inset space-y-2 rounded-card p-4">
          <span className="badge badge-info">OKKO · REST</span>
          <p className="break-all font-mono text-2xs text-txt-primary">{OKKO_BASE}/v2/&lt;ресурс&gt;</p>
          <p className="text-2xs leading-relaxed text-txt-muted">
            ERP Gateway. Автентифікація — заголовок <code>X-API-KEY</code>, самопідписаний
            сертифікат (перевірка вимкнена). Гроші в копійках, обʼєм у мілілітрах, максимум 30 днів
            на запит транзакцій.
          </p>
        </div>
        <div className="glass-inset space-y-2 rounded-card p-4">
          <span className="badge badge-success">Shell · REST/POST</span>
          <p className="break-all font-mono text-2xs text-txt-primary">
            {SHELL_BASE}/fleetmanagement/v1/&lt;ресурс&gt;
          </p>
          <p className="text-2xs leading-relaxed text-txt-muted">
            Fleet Management. Усе — <code>POST</code>, авторизація <code>Basic</code> +{' '}
            <code>apikey</code>, дати <code>YYYYMMDD</code>, суми у валюті рахунку (EUR). Картки й АЗС
            похідні від транзакцій.
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
${API_BASE}/api/{contracts|cards|merchants|transactions|analytics}   ← наш NestJS-шлюз
   │  додає ключі вендора, нормалізує одиниці, зливає бренди, пагінує в памʼяті
   ▼
OKKO   ${OKKO_BASE}/v2/...            ( X-API-KEY )
Shell  ${SHELL_BASE}/fleetmanagement/v1/...   ( Basic + apikey, POST )`}
        />
      </div>

      <div className="space-y-2">
        <span className="micro-label">Крос-вендорний параметр brand</span>
        <div className="glass-inset rounded-card p-4">
          <p className="text-2xs leading-relaxed text-txt-muted">
            <code>/api/cards</code>, <code>/api/merchants</code>, <code>/api/transactions</code> та{' '}
            <code>/api/analytics/*</code> приймають <code>brand=ALL|OKKO|SHELL</code>. Шлюз фанаутить
            у потрібні сервіси, мапить PascalCase-поля Shell на snake_case-форму OKKO, конкатенує й
            пагінує результат. <code>ALL</code> — обидва бренди разом.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <span className="micro-label">Правила OKKO</span>
          <div className="space-y-2">
            {OKKO_TRANSPORT_NOTES.map((n) => (
              <div key={n.title} className="glass-inset rounded-card p-3">
                <p className="text-2xs font-semibold text-txt-primary">{n.title}</p>
                <p className="mt-1 text-2xs leading-relaxed text-txt-muted">{n.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <span className="micro-label">Правила Shell</span>
          <div className="space-y-2">
            {SHELL_TRANSPORT_NOTES.map((n) => (
              <div key={n.title} className="glass-inset rounded-card p-3">
                <p className="text-2xs font-semibold text-txt-primary">{n.title}</p>
                <p className="mt-1 text-2xs leading-relaxed text-txt-muted">{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Note>
        Ключі, паролі й секрети живуть лише в <code>backend/.env</code> (
        <code>OKKO_API_KEY</code>, <code>OKKO_LOGIN</code>, <code>OKKO_PASSWORD</code>,{' '}
        <code>SHELL_API_KEY</code>, <code>SHELL_SECRET</code>, <code>SHELL_PAYER_NUMBER</code>,{' '}
        <code>SHELL_COLCO_CODE</code>). У код, документацію чи браузер вони не потрапляють.
      </Note>
    </div>
  );
}

function OkkoTab() {
  return (
    <VendorTab groups={OKKO_GROUPS} searchPlaceholder="Пошук за методом, шляхом або ендпоінтом OKKO…">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="glass-inset space-y-2 rounded-card p-4">
          <SectionTitle icon={KeyRound} title="Статуси карток (CHST)" />
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Опис</th>
                  <th>Робоча</th>
                </tr>
              </thead>
              <tbody>
                {OKKO_CARD_STATUS_REF.map((s) => (
                  <tr key={s.code}>
                    <td className="font-mono text-2xs text-txt-primary">{s.code}</td>
                    <td className="text-2xs text-txt-secondary">{s.ua}</td>
                    <td>
                      {s.active ? (
                        <span className="badge badge-success">так</span>
                      ) : (
                        <span className="text-2xs text-txt-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-2xs leading-relaxed text-txt-muted">
            <code>is_active</code> — true лише для CHST0 / CHST4 (та legacy <code>ACTV</code>).
          </p>
        </div>

        <div className="glass-inset space-y-2 rounded-card p-4">
          <SectionTitle icon={ListTree} title="Типи транзакцій" />
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Опис</th>
                  <th>Повернення</th>
                </tr>
              </thead>
              <tbody>
                {OKKO_TX_TYPES.map((t) => (
                  <tr key={t.code}>
                    <td className="font-mono text-2xs text-txt-primary">{t.code}</td>
                    <td className="text-2xs text-txt-secondary">{t.ua}</td>
                    <td>
                      {t.isReturn ? (
                        <span className="badge badge-danger">так</span>
                      ) : (
                        <span className="text-2xs text-txt-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-2xs leading-relaxed text-txt-muted">
            Невідомий код зі <code>reversal=true</code> теж вважається поверненням.
          </p>
        </div>
      </div>
    </VendorTab>
  );
}

function ShellTab() {
  return (
    <VendorTab groups={SHELL_GROUPS} searchPlaceholder="Пошук за методом, шляхом або ендпоінтом Shell…">
      <div className="glass-inset space-y-3 rounded-card p-4">
        <SectionTitle
          icon={Layers}
          title="Групи товарів Shell (ProductGroupName)"
          subtitle="Джерело істини для класифікації — назва групи від вендора. Числовий id доповнює її, але не замінює: реальні дані містять групи поза документованим діапазоном 1..21."
        />
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Категорія (Shell)</th>
                <th>Українською</th>
                <th>Тип</th>
              </tr>
            </thead>
            <tbody>
              {SHELL_CATEGORY_REF.map((c) => (
                <tr key={c.en}>
                  <td className="font-mono text-2xs text-txt-primary">{c.en}</td>
                  <td className="text-2xs text-txt-secondary">{c.ua}</td>
                  <td>
                    {c.fuel ? (
                      <span className="badge badge-success">пальне</span>
                    ) : c.fee ? (
                      <span className="badge badge-warn">збір</span>
                    ) : (
                      <span className="badge badge-neutral">товар/послуга</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-2xs leading-relaxed text-txt-muted">
          Стабільний код фільтра: <code>SHELL_G&lt;id&gt;</code> для кожної групи, інакше{' '}
          <code>SHELL_FEE</code> / <code>SHELL_PURCHASE</code>.
        </p>
      </div>
    </VendorTab>
  );
}

/* ── панель на всю сторінку ────────────────────────────────────────────── */

export default function VendorApiDocs() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent">
            <Fuel className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-txt-primary">
              OKKO &amp; Shell — документація інтеграції
            </h3>
            <p className="mt-0.5 text-2xs text-txt-muted">
              Куди шлюз пересилає кожен запит, у якому форматі, з якими одиницями та нормалізацією
            </p>
          </div>
        </div>

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
      </section>

      <section className="glass-panel rise p-5 sm:p-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'okko' && <OkkoTab />}
        {tab === 'shell' && <ShellTab />}
      </section>
    </div>
  );
}
