'use client';

import React, { useState } from 'react';
import { Terminal, Send, Copy, Check, Server, BookOpen } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { usePersistentState } from '@/lib/usePersistentState';
import RuptelaApiDocs from './RuptelaApiDocs';
import { t } from '@/lib/i18n';

const ENDPOINTS = [
  { group: 'common.okko', items: [
    { label: 'console.contractList', value: '/api/contracts' },
    { label: 'common.fuelCards', value: '/api/cards' },
    { label: 'console.cardStatistics', value: '/api/cards/stats' },
    { label: 'console.fuelStations', value: '/api/merchants' },
    { label: 'console.refuellingLog', value: '/api/transactions' },
  ]},
  { group: 'console.analytics', items: [
    { label: 'console.summaryAnalytics', value: '/api/analytics/summary' },
    { label: 'console.fuelMix', value: '/api/analytics/fuel-breakdown' },
    { label: 'console.spendingTrend', value: '/api/analytics/spending-trends' },
  ]},
  { group: 'console.shellRuptela', items: [
    { label: 'console.shellAccounts', value: '/api/shell/accounts' },
    { label: 'console.shellTransactions', value: '/api/shell/transactions' },
    { label: 'console.ruptelaGatewayStatus', value: '/api/ruptela/status' },
    { label: 'console.ruptelaVehicles', value: '/api/ruptela/vehicles' },
  ]},
  // GET-довідники FMS; параметризовані звіти вимагають query — приклад у плейсхолдері
  { group: 'console.ruptelaFmsInsights', items: [
    { label: 'console.driversV2', value: '/api/ruptela/insights/drivers' },
    { label: 'common.geofences', value: '/api/ruptela/insights/geozones' },
    { label: 'common.vehicleGroups', value: '/api/ruptela/insights/object-groups' },
    { label: 'console.users', value: '/api/ruptela/insights/users' },
    { label: 'console.publicLinks', value: '/api/ruptela/insights/share-links' },
    { label: 'console.eventRules', value: '/api/ruptela/insights/events' },
    { label: 'console.fuelEventsObjectidRequired', value: '/api/ruptela/insights/fuel-events?objectId=<id>&from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'console.vehicleEcoDrivingRequired', value: '/api/ruptela/insights/ecodriving/object/<id>?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'console.vehicleCountriesRequired', value: '/api/ruptela/insights/countries/object/<id>?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'console.vehicleTrackRequired', value: '/api/ruptela/insights/coordinates/<id>?from=2026-08-03T00:00:00Z&to=2026-08-04T00:00:00Z&limit=50' },
    { label: 'console.lastDriverAssignment', value: '/api/ruptela/insights/assignations/last?objectId=<id>' },
    { label: 'console.detectedEventsRequired', value: '/api/ruptela/insights/detected-events?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'console.driverStatesRequired', value: '/api/ruptela/insights/drivers/<id>/states?from=2026-07-28T00:00:00Z&to=2026-08-04T00:00:00Z' },
    { label: 'console.driverWorkingTimeAnalysis', value: '/api/ruptela/insights/drivers/<id>/time-analysis' },
    { label: 'console.sentgeoStatus', value: '/api/ruptela/insights/sentgeo/<id>' },
  ]},
  // Routing & Tasking — GraphQL під капотом; шлюз віддає їх звичайним REST
  { group: 'console.ruptelaRoutingTasking', items: [
    { label: 'console.tripGatewayStatus', value: '/api/ruptela/routing/status' },
    { label: 'console.activeTrips', value: '/api/ruptela/trips?scope=active' },
    { label: 'console.tripArchiveFirstRequest', value: '/api/ruptela/trips?scope=archive' },
    { label: 'console.singleTrip', value: '/api/ruptela/trips/<uuid>' },
    { label: 'console.driverTasks', value: '/api/ruptela/tasks' },
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
        hint: t('console.makeSureNestjsBackend', { v0: API_BASE }),
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
                {t('console.interactiveTestingGatewayEndpoints')}
              </p>
            </div>
          </div>

          {/* Документація Ruptela відкривається окремим вікном — вона задовга для сторінки */}
          <button onClick={() => setDocsOpen(true)} className="btn btn-ghost">
            <BookOpen className="h-3.5 w-3.5 text-warn" />
            <span>{t('console.ruptelaDocumentation')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="micro-label mb-1.5 block">{t('console.endpoint')}</span>
            <select
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="field"
            >
              {ENDPOINTS.map((g) => (
                <optgroup key={g.group} label={t(g.group)}>
                  {g.items.map((ep) => (
                    <option key={ep.value} value={ep.value}>
                      GET {ep.value} — {t(ep.label)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button onClick={runRequest} disabled={loading} className="btn btn-primary h-[42px] px-5">
              <Send className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
              <span>{loading ? t('console.runningEllipsis') : t('console.sendRequest')}</span>
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
              {t('console.whereGatewayForwardsRequest')}
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
                {status === 0 ? t('common.offline') : `HTTP ${status}`}
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
              <span>{copied ? t('console.copied') : t('console.copyJSON')}</span>
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
