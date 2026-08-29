'use client';

/**
 * Shared API-reference engine — the presentational primitives that back both the
 * fuel-vendor docs (OKKO/Shell, emerald accent, full-page) and the Ruptela docs
 * (FMS/RnT, amber accent, modal). These were duplicated byte-for-byte across
 * `VendorApiDocs.tsx` and `RuptelaApiDocs.tsx`; they live here once and each
 * feature supplies its own tab content and doc `source`.
 *
 * Author's Ukrainian copy here is a developer reference and is on the i18n EXCLUDE
 * list — same as its two call sites.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, Copy, Check, Search, ArrowRight, AlertTriangle, Info } from 'lucide-react';

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface DocParam {
  name: string;
  required?: boolean;
  note: string;
}

export interface DocMethod {
  id: string;
  title: string;
  verb: HttpVerb;
  path: string;
  summary: string;
  upstream: { verb: HttpVerb; url: string; note?: string };
  params?: DocParam[];
  body?: string;
  response?: string;
  notes?: string[];
}

export interface DocGroup {
  id: string;
  title: string;
  blurb: string;
  methods: DocMethod[];
}

export const VERB_BADGE: Record<HttpVerb, string> = {
  GET: 'badge-info',
  POST: 'badge-success',
  PUT: 'badge-warn',
  PATCH: 'badge-warn',
  DELETE: 'badge-danger',
};

/* ── дрібні блоки ──────────────────────────────────────────────────────── */

export function CopyButton({ text, label = 'Копіювати' }: { text: string; label?: string }) {
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

export function Code({ title, code }: { title?: string; code: string }) {
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

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
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

/**
 * Section heading with an icon chip. `accent` picks the chip colour so the same
 * component serves the emerald fuel docs and the amber telematics docs.
 */
export function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  accent = 'accent',
}: {
  icon: any;
  title: string;
  subtitle?: string;
  accent?: 'accent' | 'warn';
}) {
  const chip = accent === 'warn' ? 'bg-warn/10 text-warn' : 'bg-accent-soft text-accent';
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-field ${chip}`}>
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

export function MethodCard({
  method,
  expanded,
  onToggle,
  upstreamTitle = 'upstream',
}: {
  method: DocMethod;
  expanded: boolean;
  onToggle: () => void;
  upstreamTitle?: string;
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
            <Code title={upstreamTitle} code={upstreamCurl} />
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

/* ── grouped, searchable method list ───────────────────────────────────── */

/**
 * The searchable, expand-all list of grouped methods — the shared body that both
 * the vendor tabs and the Ruptela REST tab were re-implementing. Pass the groups,
 * a search placeholder, an optional upstream code-block title, and any reference
 * tables as `children` (shown only when the search box is empty).
 */
export function MethodExplorer({
  groups,
  searchPlaceholder,
  upstreamTitle,
  children,
}: {
  groups: DocGroup[];
  searchPlaceholder: string;
  upstreamTitle?: string;
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
                upstreamTitle={upstreamTitle}
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
