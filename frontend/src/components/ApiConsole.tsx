'use client';

import React, { useState } from 'react';
import { Terminal, Send, Copy, Check, Server, BookOpen } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { usePersistentState } from '@/lib/usePersistentState';
import RuptelaApiDocs from './RuptelaApiDocs';

const ENDPOINTS = [
  { group: 'OKKO', items: [
    { label: 'Список договорів', value: '/api/contracts' },
    { label: 'Паливні картки', value: '/api/cards' },
    { label: 'Статистика карток', value: '/api/cards/stats' },
    { label: 'Станції АЗК', value: '/api/merchants' },
    { label: 'Журнал заправок', value: '/api/transactions' },
  ]},
  { group: 'Аналітика', items: [
    { label: 'Сумарна аналітика', value: '/api/analytics/summary' },
    { label: 'Структура пального', value: '/api/analytics/fuel-breakdown' },
    { label: 'Динаміка витрат', value: '/api/analytics/spending-trends' },
  ]},
  { group: 'Shell / Ruptela', items: [
    { label: 'Shell — акаунти', value: '/api/shell/accounts' },
    { label: 'Shell — транзакції', value: '/api/shell/transactions' },
    { label: 'Ruptela — статус шлюзу', value: '/api/ruptela/status' },
    { label: 'Ruptela — транспорт', value: '/api/ruptela/vehicles' },
  ]},
  // GET-довідники FMS; параметризовані звіти вимагають query — приклад у плейсхолдері
  { group: 'Ruptela FMS Insights', items: [
    { label: 'Водії (v2)', value: '/api/ruptela/insights/drivers' },
    { label: 'Геозони', value: '/api/ruptela/insights/geozones' },
    { label: 'Групи транспорту', value: '/api/ruptela/insights/object-groups' },
    { label: 'Користувачі', value: '/api/ruptela/insights/users' },
    { label: 'Публічні посилання', value: '/api/ruptela/insights/share-links' },
    { label: 'Правила подій', value: '/api/ruptela/insights/events' },
    { label: 'Паливні події (потрібні objectId, from, to)', value: '/api/ruptela/insights/fuel-events?objectId=<id>&from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'Еко-водіння ТЗ (потрібні from, to)', value: '/api/ruptela/insights/ecodriving/object/<id>?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'Країни ТЗ (потрібні from, to)', value: '/api/ruptela/insights/countries/object/<id>?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'Трек ТЗ (потрібні from, to)', value: '/api/ruptela/insights/coordinates/<id>?from=2026-08-03T00:00:00Z&to=2026-08-04T00:00:00Z&limit=50' },
    { label: 'Останнє призначення водія', value: '/api/ruptela/insights/assignations/last?objectId=<id>' },
    { label: 'Детектовані події (потрібні from, to)', value: '/api/ruptela/insights/detected-events?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'Стани водія (потрібні from, to)', value: '/api/ruptela/insights/drivers/<id>/states?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'Аналіз робочого часу водія', value: '/api/ruptela/insights/drivers/<id>/time-analysis' },
    { label: 'Статус SentGeo', value: '/api/ruptela/insights/sentgeo/<id>' },
  ]},
  // Routing & Tasking — GraphQL під капотом; шлюз віддає їх звичайним REST
  { group: 'Ruptela Routing & Tasking', items: [
    { label: 'Статус шлюзу рейсів', value: '/api/ruptela/routing/status' },
    { label: 'Активні поїздки', value: '/api/ruptela/trips?scope=active' },
    { label: 'Архів поїздок (перший запит ~30 с)', value: '/api/ruptela/trips?scope=archive' },
    { label: 'Одна поїздка', value: '/api/ruptela/trips/<uuid>' },
    { label: 'Завдання водіям', value: '/api/ruptela/tasks' },
  ]},
];

export default function ApiConsole() {
  const [endpoint, setEndpoint] = usePersistentState('veles_console_endpoint', '/api/contracts');
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const runRequest = async () => {
    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      setStatus(res.status);
      setLatency(Math.round(performance.now() - start));
      setResponse(await res.json());
    } catch (e: any) {
      setStatus(0);
      setLatency(Math.round(performance.now() - start));
      setResponse({
        error: e?.message ?? 'Network error',
        hint: `Переконайтесь, що NestJS backend запущено на ${API_BASE}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const ok = status !== null && status >= 200 && status < 300;

  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field bg-accent-soft text-accent">
              <Terminal className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-txt-primary">Live API Inspector</h3>
              <p className="mt-0.5 text-2xs text-txt-muted">
                Інтерактивне тестування ендпоінтів шлюзу та перегляд сирих JSON-відповідей
              </p>
            </div>
          </div>

          {/* Документація Ruptela відкривається окремим вікном — вона задовга для сторінки */}
          <button onClick={() => setDocsOpen(true)} className="btn btn-ghost">
            <BookOpen className="h-3.5 w-3.5 text-warn" />
            <span>Документація Ruptela</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="micro-label mb-1.5 block">Ендпоінт</span>
            <select
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="field"
            >
              {ENDPOINTS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((ep) => (
                    <option key={ep.value} value={ep.value}>
                      GET {ep.value} — {ep.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button onClick={runRequest} disabled={loading} className="btn btn-primary h-[42px] px-5">
              <Send className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
              <span>{loading ? 'Виконується…' : 'Виконати запит'}</span>
            </button>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 font-mono text-micro text-txt-muted">
          <Server className="h-3 w-3" />
          {API_BASE}
          {endpoint}
        </p>

        {endpoint.startsWith('/api/ruptela') && (
          <button
            onClick={() => setDocsOpen(true)}
            className="mt-2 flex items-center gap-1.5 text-2xs text-warn transition hover:opacity-80"
          >
            <BookOpen className="h-3 w-3" />
            <span>
              Куди шлюз пересилає цей запит, у якому форматі та як зробити те саме з Delphi →
            </span>
          </button>
        )}
      </section>

      {status !== null && (
        <section className="glass-panel rise p-5 sm:p-6">
          <div className="hairline-b mb-4 flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${ok ? 'badge-success' : 'badge-danger'}`}>
                <span className="badge-dot" />
                {status === 0 ? 'Немає звʼязку' : `HTTP ${status}`}
              </span>
              <span className="badge badge-neutral">
                <span className="tabular">{latency} ms</span>
              </span>
            </div>

            <button onClick={copyJson} className="btn btn-ghost">
              {copied ? (
                <Check className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copied ? 'Скопійовано' : 'Копіювати JSON'}</span>
            </button>
          </div>

          <div className="glass-inset overflow-hidden">
            <div className="hairline-b flex items-center gap-2 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-danger/60" />
              <span className="h-2 w-2 rounded-full bg-warn/60" />
              <span className="h-2 w-2 rounded-full bg-accent/60" />
              <span className="ml-2 font-mono text-micro text-txt-muted">response.json</span>
            </div>
            <pre className="max-h-[420px] overflow-auto p-4 font-mono text-2xs leading-relaxed text-txt-secondary">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        </section>
      )}

      <RuptelaApiDocs open={docsOpen} onClose={() => setDocsOpen(false)} />
    </div>
  );
}
