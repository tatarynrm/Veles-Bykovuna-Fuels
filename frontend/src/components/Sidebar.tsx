'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTour } from '@/context/TourContext';
import { useSessionUser } from '@/lib/useAuthGuard';
import {
  Eye,
  GraduationCap,
  UserCheck,
  Fuel,
  CreditCard,
  MapPin,
  History,
  BarChart3,
  Terminal,
  Truck,
  Menu,
  X,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  PlusCircle,
  Route,
  Boxes,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

interface SidebarProps {
  apiStatus?: any;
}

/** `tour` marks the element the onboarding overlay spotlights (see TourContext). */
const primaryNav = [
  { href: '/', label: 'common.dashboard', icon: Fuel, tour: 'nav-overview' },
  { href: '/cards', label: 'common.fuelCards', icon: CreditCard, tour: 'nav-cards' },
  { href: '/transactions', label: 'common.transactionLog', icon: History, tour: 'nav-transactions' },
  { href: '/analytics', label: 'common.fuelAnalytics', icon: BarChart3, tour: 'nav-analytics' },
  { href: '/merchants', label: 'common.stationNetwork', icon: MapPin, tour: 'nav-merchants' },
];

const fleetNav = [
  { href: '/fleet', label: 'nav.n3dMonitoring', icon: Boxes, tour: 'nav-fleet3d' },
];

const ruptelaNav = [
  { href: '/ruptela/fleet', label: 'common.myFleet', icon: Truck, tour: 'nav-ruptela-fleet' },
  { href: '/ruptela/live', label: 'common.realTime', icon: Radio, tour: 'nav-live' },
  {
    href: '/ruptela/create-trip',
    label: 'common.createATrip',
    icon: PlusCircle,
    tour: 'nav-create-trip',
    /** Writes to Ruptela — hidden for the read-only guest role. */
    staffOnly: true,
  },
  { href: '/ruptela/routes-tasks', label: 'common.routesAndTasks', icon: Route, tour: 'nav-routes' },
  { href: '/ruptela/insights', label: 'common.fmsReports', icon: BarChart3, tour: 'nav-insights' },
];

const systemNav = [
  { href: '/api-console', label: 'nav.apiConsole', icon: Terminal, tour: 'nav-api' },
  { href: '/ui-kit', label: 'nav.uiKit', icon: Boxes, tour: 'nav-uikit' },
];

const COLLAPSE_KEY = 'veles_sidebar_collapsed';

/** Ширина рейки в пікселях: повна і згорнута. */
const SIDEBAR_EXPANDED = 248;
const SIDEBAR_COLLAPSED = 72;

/** На сервері useLayoutEffect попереджає в консоль — там достатньо useEffect. */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Згорнутий стан живе на рівні модуля, а не лише в useState.
 *
 * PageShell (а з ним і Sidebar) належить кожній сторінці окремо, тож перехід
 * між сторінками РОЗМОНТОВУЄ панель і монтує нову. Зі станом лише в useState
 * кожна нова панель починала життя розгорнутою і згорталась уже після
 * відновлення з localStorage — та сама «рейка розкрилась і закрилась» на
 * кожному переході. Модульна змінна переживає розмонтування, тож друга й
 * наступні панелі малюються одразу правильної ширини й без анімації.
 *
 * `null` = ще не читали зі сховища (перший рендер після гідратації має збігтися
 * з розміткою сервера, тому там свідомо лишається `false`).
 */
let collapsedCache: boolean | null = null;

export default function Sidebar({ apiStatus }: SidebarProps) {
  const pathname = usePathname();
  const { startTour } = useTour();
  const { user, isGuest } = useSessionUser();
  const [isOpen, setIsOpen] = useState(false);
  const [ruptelaOpen, setRuptelaOpen] = useState(true);
  /** Згорнутий стан діє лише на десктопі; у шухляді панель завжди повна. */
  const [collapsed, setCollapsed] = useState(() => collapsedCache ?? false);
  /**
   * Поки false, ширина міняється без анімації: інакше перше застосування
   * збереженого стану програвало б згортання просто на очах. На переходах між
   * сторінками значення вже відоме з кешу, тож анімація доступна одразу.
   */
  const [restored, setRestored] = useState(() => collapsedCache !== null);

  // Layout-ефект, а не звичайний: стан треба застосувати ДО малювання, щоб
  // рейка не встигла з'явитися широкою й стрибнути. Після першого разу
  // значення вже в кеші, і ефект нічого не міняє.
  useIsomorphicLayoutEffect(() => {
    if (collapsedCache !== null) return;
    try {
      collapsedCache = localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      /* приватний режим — лишаємо розгорнутою */
      collapsedCache = false;
    }
    setCollapsed(collapsedCache);
    setRestored(true);
  }, []);

  const toggleCollapsed = () => {
    // Запис саме тут, а не всередині оновлювача стану: у React 18 оновлювач
    // у режимі розробки викликається двічі, і збереження перезаписувало б себе.
    const next = !collapsed;
    collapsedCache = next;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      /* best-effort */
    }
  };

  useEffect(() => {
    if (pathname.startsWith('/ruptela')) setRuptelaOpen(true);
  }, [pathname]);

  // Close the drawer whenever the route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape closes the drawer
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const isLive = apiStatus?.isLiveConnected ?? true;

  /**
   * Панель малюється двічі: рейка на десктопі й шухляда на мобільному. Згортання
   * стосується лише рейки, тому стан приходить параметром, а не з хука.
   */
  const renderContent = (isCollapsed: boolean) => {
    const NavLink = ({
      href,
      label,
      icon: Icon,
      tour,
    }: {
      href: string;
      label: string;
      icon: React.ElementType;
      tour?: string;
    }) => {
      const active = pathname === href;
      return (
        <Link
          href={href}
          data-tour={tour}
          title={isCollapsed ? t(label) : undefined}
          className={`nav-item ${active ? 'nav-item-active' : ''} ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          aria-current={active ? 'page' : undefined}
        >
          {active && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent"
            />
          )}
          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : 'text-txt-muted'}`} />
          {/* Масиви навігації тримають ключі — перекладаємо тут. */}
          {!isCollapsed && <span className="truncate">{t(label)}</span>}
        </Link>
      );
    };

    const SectionLabel = ({ children }: { children: React.ReactNode }) =>
      isCollapsed ? (
        // У згорнутому стані підпис розділу замінює тонка риска — інакше
        // обрізаний текст виглядав би як помилка рендеру.
        <div aria-hidden className="mx-auto my-3 h-px w-6 bg-bdr-subtle first:mt-0" />
      ) : (
        <p className="micro-label px-3 pb-1.5 pt-5 first:pt-0">{children}</p>
      );

    return (
      <aside
        /*
          Ширина — інлайн-стилем, а не Tailwind-класом: довільне значення
          (`w-[72px]`) генерується JIT-ом і після кількох гарячих перезбірок
          у dev його правило зникало, а панель лишалась широкою. Перехід на
          inline-width прибирає цю залежність, а CSS-перехід працює однаково.
        */
        style={{ width: isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
        /*
          Три зони: шапка й футер закріплені, прокручується лише меню.
          Тому на самій панелі overflow-hidden, а не auto — інакше довгий
          список навігації тягнув би за собою і логотип, і статус шлюзу.
        */
        className={`flex h-full flex-col overflow-hidden border-r border-bdr-subtle bg-glass py-4 backdrop-blur-chrome ${
          restored ? 'transition-[width,padding] duration-300 ease-enter' : ''
        } ${isCollapsed ? 'px-2' : 'px-3'}`}
      >
        {/* ── Закріплена шапка ── */}
        <div className="shrink-0">
          {/* Brand */}
          <div
            className={`mb-2 flex items-center gap-1 ${
              isCollapsed ? 'flex-col justify-center' : 'justify-between px-1'
            }`}
          >
            <Link
              href="/"
              data-tour="brand"
              title={isCollapsed ? 'VELES ERP' : undefined}
              className="group flex min-w-0 items-center gap-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field bg-accent-sheen shadow-accent-glow transition-transform duration-200 group-hover:scale-105">
                <Fuel className="h-4 w-4 text-white" />
              </div>
              {!isCollapsed && (
                <div className="leading-tight">
                  <p className="text-sm font-semibold tracking-tight text-txt-primary">
                    VELES <span className="text-accent">ERP</span>
                  </p>
                  <p className="text-micro font-medium uppercase text-txt-muted">
                    BUKOVYNA FUELS
                  </p>
                </div>
              )}
            </Link>

            {/* Згортання — лише на десктопі, у шухляді натомість «закрити» */}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
              aria-label={isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
              aria-expanded={!isCollapsed}
              className="btn-icon hidden shrink-0 lg:flex"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={() => setIsOpen(false)}
              aria-label={t('nav.closeMenu')}
              className="btn-icon lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/*
          ── Прокручуване меню ──
          min-h-0 обовʼязковий: без нього flex-елемент не стискається нижче
          висоти свого вмісту, і замість власної прокрутки меню виштовхнуло б
          футер за межі панелі.
        */}
        <nav className="-mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1">
          <SectionLabel>{t('nav.overview')}</SectionLabel>
          <div className="space-y-0.5">
            {primaryNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          <SectionLabel>{t('nav.fleet')}</SectionLabel>
          <div className="space-y-0.5">
            {fleetNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}

            {/* Ruptela telematics group */}
            <div
              className={`glass-inset mt-1 ${isCollapsed ? 'p-0.5' : 'p-1'}`}
              data-tour="nav-ruptela"
            >
              {isCollapsed ? (
                // Згорнутою рейкою розділ уже не згортається вдруге: підпункти
                // показуються як іконки, бо ховати їх за ще одним кліком нікуди.
                <div className="space-y-0.5">
                  {ruptelaNav
                    .filter((sub) => !(sub.staffOnly && isGuest))
                    .map((sub) => {
                      const active = pathname === sub.href;
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          data-tour={sub.tour}
                          title={t(sub.label)}
                          className={`flex items-center justify-center rounded-control py-2 transition-colors ${
                            active
                              ? 'bg-warn/10 text-warn'
                              : 'text-txt-secondary hover:bg-surface-hover hover:text-txt-primary'
                          }`}
                        >
                          <SubIcon
                            className={`h-4 w-4 ${active ? 'text-warn' : 'text-txt-muted'}`}
                          />
                        </Link>
                      );
                    })}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setRuptelaOpen((v) => !v)}
                    aria-expanded={ruptelaOpen}
                    className={`flex w-full items-center justify-between rounded-control px-2.5 py-1.5 text-2xs font-semibold transition-colors ${
                      pathname.startsWith('/ruptela')
                        ? 'text-warn'
                        : 'text-txt-secondary hover:text-txt-primary'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Radio className="h-3.5 w-3.5 text-warn" />
                      <span>Ruptela FMS</span>
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-txt-muted transition-transform duration-200 ${
                        ruptelaOpen ? '' : '-rotate-90'
                      }`}
                    />
                  </button>

                  {ruptelaOpen && (
                    <div className="mt-0.5 space-y-0.5 pl-1">
                      {ruptelaNav
                        .filter((sub) => !(sub.staffOnly && isGuest))
                        .map((sub) => {
                          const active = pathname === sub.href;
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              data-tour={sub.tour}
                              className={`flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-2xs transition-colors ${
                                active
                                  ? 'bg-warn/10 font-semibold text-warn'
                                  : 'text-txt-secondary hover:bg-surface-hover hover:text-txt-primary'
                              }`}
                            >
                              <SubIcon
                                className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-warn' : 'text-txt-muted'}`}
                              />
                              <span className="truncate">{t(sub.label)}</span>
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <SectionLabel>{t('nav.system')}</SectionLabel>
          <div className="space-y-0.5">
            {systemNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>

        {/* ── Закріплений футер ── */}
        <div
          className={`hairline-t mt-2 shrink-0 pt-3 ${
            isCollapsed ? 'space-y-2' : 'space-y-2.5'
          }`}
        >
          {/* Onboarding — always reachable, whether or not the first-run offer was taken */}
          <button
            type="button"
            data-tour="tour-button"
            onClick={startTour}
            className={`btn btn-ghost w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`}
            title={t('nav.takeInterfaceTour')}
          >
            <GraduationCap className="h-4 w-4 text-accent" />
            {!isCollapsed && <span>{t('common.training')}</span>}
          </button>

          {/* Who is signed in — a guest needs to know why buttons are missing */}
          {user && (
            <div
              data-tour="role"
              title={isCollapsed ? (user.name ?? user.username) : undefined}
              className={`glass-inset flex items-center gap-2.5 ${
                isCollapsed ? 'justify-center p-1.5' : 'p-2.5'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${
                  isGuest ? 'bg-warn/10 text-warn' : 'bg-accent-soft text-accent'
                }`}
              >
                {isGuest ? <Eye className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
              </span>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-2xs font-medium text-txt-primary">
                    {user.name ?? user.username}
                  </p>
                  <p className="truncate text-micro text-txt-muted">
                    {isGuest ? t('common.viewOnly') : t('nav.fullAccess')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/*
            Мова і тема стоять одним рядком: разом вони займають стільки ж, скільки
            раніше займав самий лише вибір мови з чотирьох кнопок.
            У згорнутій рейці їх немає — обидва перемикачі є в топбарі.
          */}
          {!isCollapsed && (
            <div className="flex items-center gap-1.5">
              {/* Меню розкривається вгору й малюється порталом: футер панелі
                  стоїть біля низу екрана, а сама панель має overflow. */}
              <LanguageSwitcher
                variant="compact"
                align="left"
                direction="up"
                className="shrink-0"
              />
              <ThemeSwitcher className="min-w-0 flex-1" />
            </div>
          )}

          {/* Gateway status */}
          {isCollapsed ? (
            <div
              className="flex justify-center py-1"
              title={`${t('nav.integrationGateway')} — ${isLive ? t('nav.online') : t('nav.offline')}`}
            >
              {isLive ? (
                <span className="live-dot" aria-label={t('nav.online')} />
              ) : (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-danger"
                  aria-label={t('nav.offlineLabel')}
                />
              )}
            </div>
          ) : (
            <div className="glass-inset p-3">
              <div className="flex items-center justify-between">
                <span className="micro-label">{t('nav.integrationGateway')}</span>
                {isLive ? (
                  <span className="live-dot" aria-label={t('nav.online')} />
                ) : (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-danger"
                    aria-label={t('nav.offlineLabel')}
                  />
                )}
              </div>
              <p className="mt-1.5 text-2xs font-medium text-txt-secondary">
                OKKO · Shell · Ruptela
              </p>
              <p className="mt-0.5 font-mono text-micro text-txt-muted">
                {isLive ? 'PROD GATEWAY :9443' : t('nav.offline')}
              </p>
            </div>
          )}
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Desktop rail */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        {renderContent(collapsed)}
      </div>

      {/* Mobile trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t('nav.openMenu')}
          className="glass fixed left-4 top-3.5 z-50 flex h-9 w-9 items-center justify-center rounded-control text-txt-primary lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {/* Mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={`fixed left-0 top-0 z-50 h-full transition-transform duration-300 ease-enter lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderContent(false)}
      </div>
    </>
  );
}
