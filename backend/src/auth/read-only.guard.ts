import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { roleFromToken, isGuestRole } from './session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Blocks every write for a guest session, globally.
 *
 * Hiding the "create trip" button is not enough: a trip created through the UI is
 * written to Ruptela's live Routing & Tasking API and can page a real driver. The
 * ban therefore lives on the server, covers *every* non-GET route (including ones
 * added later), and is the reason `apiSend` on the frontend now carries the token.
 *
 * Note this guard restricts guests only — it is not an authentication gate. No route
 * here has ever required a token, and adding one is a separate job.
 */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = String(request?.method ?? 'GET').toUpperCase();

    if (SAFE_METHODS.has(method)) return true;

    // Logging in is a POST; locking it would lock guests out of their own session.
    const path = String(request?.path ?? request?.url ?? '');
    if (path.startsWith('/api/auth')) return true;

    if (isGuestRole(roleFromToken(request?.headers?.authorization))) {
      throw new ForbiddenException(
        'Гостьовий доступ: перегляд без змін. Створення та редагування недоступні.',
      );
    }

    return true;
  }
}
