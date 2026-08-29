'use client';

/**
 * Документація інтеграції паливних вендорів (OKKO + Shell) для сторінки «Документація API».
 *
 * Презентаційний рушій (вкладки-картки методів, VERB-бейджі, копіювання, пошук, нотатки)
 * спільний з RuptelaApiDocs.tsx — він живе в `@/shared/ui/api-reference`. Тут лишається лише
 * вміст вкладок паливного домену: продуктовий акцент (emerald) і рендер повноекранною
 * панеллю на сторінці, а не модальним вікном.
 *
 * Це технічний довідник для розробника — він у списку i18n EXCLUDE: український текст тут
 * авторський і не перекладається. Дані (шляхи, поля, JSON) — теж дані вендора.
 */

import React, { useState } from 'react';
import { Server, Fuel, Layers, ListTree, KeyRound } from 'lucide-react';
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
} from '@/shared/config/vendorApiDocs';
import { API_BASE } from '@/lib/api';
import { Code, Note, SectionTitle, MethodExplorer } from '@/shared/ui/api-reference';

type Tab = 'overview' | 'okko' | 'shell';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Огляд' },
  { id: 'okko', label: 'OKKO' },
  { id: 'shell', label: 'Shell' },
];

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
    <MethodExplorer groups={OKKO_GROUPS} searchPlaceholder="Пошук за методом, шляхом або ендпоінтом OKKO…">
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
    </MethodExplorer>
  );
}

function ShellTab() {
  return (
    <MethodExplorer groups={SHELL_GROUPS} searchPlaceholder="Пошук за методом, шляхом або ендпоінтом Shell…">
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
    </MethodExplorer>
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
