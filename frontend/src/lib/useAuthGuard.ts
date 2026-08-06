'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearApiCache } from './apiCache';

export interface SessionPermissions {
  readOnly: boolean;
  canCreateTrips: boolean;
  canEditTrips: boolean;
  canDeleteTrips: boolean;
}

export interface SessionUser {
  username: string;
  name?: string;
  role?: string;
  allowedBrands?: string[];
  permissions?: SessionPermissions;
}

export const GUEST_ROLE = 'GUEST';

/** Reads the stored session without redirecting — safe in always-mounted chrome. */
export function readSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('veles_user');
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    /* stored user is optional */
    return null;
  }
}

export const isGuestUser = (user: SessionUser | null): boolean =>
  user?.role === GUEST_ROLE;

/**
 * What the UI may offer. The server enforces the same rules in `ReadOnlyGuard`;
 * this only keeps a guest from being shown a button that would come back 403.
 */
export function permissionsOf(user: SessionUser | null): SessionPermissions {
  const guest = isGuestUser(user);
  return (
    user?.permissions ?? {
      readOnly: guest,
      canCreateTrips: !guest,
      canEditTrips: !guest,
      canDeleteTrips: !guest,
    }
  );
}

/**
 * Session for chrome that renders on every page (sidebar, shells). Unlike
 * `useAuthGuard` it never redirects — it only reports who is logged in.
 */
export function useSessionUser(): { user: SessionUser | null; isGuest: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(readSessionUser());
  }, []);

  return { user, isGuest: isGuestUser(user) };
}

/**
 * Client-side session gate shared by every authenticated page.
 * Redirects to /login when no token is present.
 */
export function useAuthGuard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('veles_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setAuthenticated(true);
    setUser(readSessionUser());
  }, [router]);

  return {
    authenticated,
    user,
    isGuest: isGuestUser(user),
    permissions: permissionsOf(user),
  };
}

export function signOut() {
  localStorage.removeItem('veles_token');
  localStorage.removeItem('veles_user');
  // Кеш відповідей переживає перезавантаження, тож без цього наступний, хто
  // ввійде на цьому ж комп'ютері, побачив би дані попередньої сесії ще до
  // першої відповіді сервера.
  clearApiCache();
}
