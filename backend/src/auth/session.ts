/**
 * The dashboard "session" is still a stub: the token is a timestamp plus the role,
 * not a signed JWT, and it is trivially forgeable. It is enough to keep a guest from
 * changing data by accident — which is what it exists for — and nothing more.
 * Anything that needs real authentication has to replace this whole file.
 */

export type SessionRole = 'SUPER_ADMIN' | 'OKKO_ADMIN' | 'SHELL_ADMIN' | 'GUEST';

const KNOWN_ROLES: SessionRole[] = ['SUPER_ADMIN', 'OKKO_ADMIN', 'SHELL_ADMIN', 'GUEST'];

/** `veles_session_<epoch-ms>_<ROLE>` — the one place this format is written. */
export function makeSessionToken(role: SessionRole): string {
  return `veles_session_${Date.now()}_${role}`;
}

/** Reads the role back out of a raw token or an `Authorization: Bearer …` header. */
export function roleFromToken(raw?: string | null): SessionRole | null {
  if (!raw) return null;

  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();
  const match = /^veles_session_\d+_([A-Z_]+)$/.exec(token);
  if (!match) return null;

  const role = match[1] as SessionRole;
  return KNOWN_ROLES.includes(role) ? role : null;
}

export const isGuestRole = (role: SessionRole | null): boolean => role === 'GUEST';

/** What the frontend is allowed to offer for a role. Guests read; nobody else is limited. */
export function permissionsFor(role: SessionRole) {
  const guest = isGuestRole(role);
  return {
    readOnly: guest,
    canCreateTrips: !guest,
    canEditTrips: !guest,
    canDeleteTrips: !guest,
  };
}
