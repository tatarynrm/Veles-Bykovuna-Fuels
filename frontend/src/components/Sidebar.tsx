'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
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
  Radio,
  PlusCircle,
  Route,
  Sun,
  Moon,
  Boxes,
} from 'lucide-react';

interface SidebarProps {
  apiStatus?: any;
}

/** `tour` marks the element the onboarding overlay spotlights (see TourContext). */
const primaryNav = [
  { href: '/', label: 'Панель керування', icon: Fuel, tour: 'nav-overview' },
  { href: '/cards', label: 'Паливні картки', icon: CreditCard, tour: 'nav-cards' },
  { href: '/transactions', label: 'Журнал транзакцій', icon: History, tour: 'nav-transactions' },
  { href: '/analytics', label: 'Аналітика палива', icon: BarChart3, tour: 'nav-analytics' },
  { href: '/merchants', label: 'Мережа АЗК', icon: MapPin, tour: 'nav-merchants' },
];

const fleetNav = [
  { href: '/fleet', label: 'Моніторинг 3D', icon: Boxes, tour: 'nav-fleet3d' },
];

const ruptelaNav = [
  { href: '/ruptela/fleet', label: 'Мій автопарк', icon: Truck, tour: 'nav-ruptela-fleet' },
  { href: '/ruptela/live', label: 'Реальний час', icon: Radio, tour: 'nav-live' },
  {
    href: '/ruptela/create-trip',
    label: 'Створити поїздку',
    icon: PlusCircle,
    tour: 'nav-create-trip',
    /** Writes to Ruptela — hidden for the read-only guest role. */
    staffOnly: true,
  },
  { href: '/ruptela/routes-tasks', label: 'Маршрут і завдання', icon: Route, tour: 'nav-routes' },
  { href: '/ruptela/insights', label: 'Звіти FMS', icon: BarChart3, tour: 'nav-insights' },
];

const systemNav = [
  { href: '/api-console', label: 'API Консоль', icon: Terminal, tour: 'nav-api' },
  { href: '/ui-kit', label: 'UI Kit', icon: Boxes, tour: 'nav-uikit' },
];

export default function Sidebar({ apiStatus }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { startTour } = useTour();
  const { user, isGuest } = useSessionUser();
  const [isOpen, setIsOpen] = useState(false);
  const [ruptelaOpen, setRuptelaOpen] = useState(true);

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

  const NavLink = ({
    href,
    label,
    icon: Icon,
    compact = false,
    tour,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
    compact?: boolean;
    tour?: string;
  }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        data-tour={tour}
        className={`nav-item ${active ? 'nav-item-active' : ''} ${compact ? 'py-1.5' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent"
          />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : 'text-txt-muted'}`} />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="micro-label px-3 pb-1.5 pt-5 first:pt-0">{children}</p>
  );

  const content = (
    <aside className="flex h-full w-[248px] flex-col justify-between overflow-y-auto border-r border-bdr-subtle bg-glass px-3 py-4 backdrop-blur-chrome">
      <div>
        {/* Brand */}
        <div className="mb-2 flex items-center justify-between px-1">
          <Link href="/" data-tour="brand" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-field bg-accent-sheen shadow-accent-glow transition-transform duration-200 group-hover:scale-105">
              <Fuel className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-txt-primary">
                VELES <span className="text-accent">ERP</span>
              </p>
              <p className="text-micro font-medium uppercase text-txt-muted">
                Bykovuna Fuels
              </p>
            </div>
          </Link>

          <button
            onClick={() => setIsOpen(false)}
            aria-label="Закрити меню"
            className="btn-icon lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav>
          <SectionLabel>Огляд</SectionLabel>
          <div className="space-y-0.5">
            {primaryNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>

          <SectionLabel>Автопарк</SectionLabel>
          <div className="space-y-0.5">
            {fleetNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}

            {/* Ruptela telematics group */}
            <div className="glass-inset mt-1 p-1" data-tour="nav-ruptela">
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
                          <span className="truncate">{sub.label}</span>
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          <SectionLabel>Система</SectionLabel>
          <div className="space-y-0.5">
            {systemNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-2.5 pt-5">
        {/* Onboarding — always reachable, whether or not the first-run offer was taken */}
        <button
          type="button"
          data-tour="tour-button"
          onClick={startTour}
          className="btn btn-ghost w-full justify-start"
          title="Пройти навчання по інтерфейсу"
        >
          <GraduationCap className="h-4 w-4 text-accent" />
          <span>Навчання</span>
        </button>

        {/* Who is signed in — a guest needs to know why buttons are missing */}
        {user && (
          <div data-tour="role" className="glass-inset flex items-center gap-2.5 p-2.5">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${
                isGuest ? 'bg-warn/10 text-warn' : 'bg-accent-soft text-accent'
              }`}
            >
              {isGuest ? <Eye className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xs font-medium text-txt-primary">
                {user.name ?? user.username}
              </p>
              <p className="truncate text-micro text-txt-muted">
                {isGuest ? 'Лише перегляд' : 'Повний доступ'}
              </p>
            </div>
          </div>
        )}

        {/* Theme */}
        <div className="segmented w-full" data-tour="theme">
          <button
            onClick={() => setTheme('light')}
            className={`segmented-item flex-1 ${theme === 'light' ? 'segmented-item-active' : ''}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Sun className="h-3.5 w-3.5" />
              Світла
            </span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`segmented-item flex-1 ${theme === 'dark' ? 'segmented-item-active' : ''}`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Moon className="h-3.5 w-3.5" />
              Темна
            </span>
          </button>
        </div>

        {/* Gateway status */}
        <div className="glass-inset p-3">
          <div className="flex items-center justify-between">
            <span className="micro-label">Шлюз інтеграцій</span>
            {isLive ? (
              <span className="live-dot" aria-label="Онлайн" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="Офлайн" />
            )}
          </div>
          <p className="mt-1.5 text-2xs font-medium text-txt-secondary">
            OKKO · Shell · Ruptela
          </p>
          <p className="mt-0.5 font-mono text-micro text-txt-muted">
            {isLive ? 'PROD GATEWAY :9443' : 'НЕМАЄ ЗВʼЯЗКУ'}
          </p>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop rail */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">{content}</div>

      {/* Mobile trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Відкрити меню"
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
        {content}
      </div>
    </>
  );
}
