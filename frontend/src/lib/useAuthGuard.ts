'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface SessionUser {
  username: string;
  name?: string;
  role?: string;
  allowedBrands?: string[];
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
    try {
      const raw = localStorage.getItem('veles_user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
      /* stored user is optional */
    }
  }, [router]);

  return { authenticated, user };
}

export function signOut() {
  localStorage.removeItem('veles_token');
  localStorage.removeItem('veles_user');
}
