import { Controller, Post, Body, UnauthorizedException, Get, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SessionRole,
  makeSessionToken,
  permissionsFor,
  roleFromToken,
} from './session';

const DEMO_USERS = ['okko', 'shell', 'demo'];

/**
 * Guest access is deliberately public: the credentials are printed on the login
 * screen. It is a read-only role — `ReadOnlyGuard` rejects every write server-side,
 * so a guest cannot create a trip in Ruptela and page a real driver.
 */
const GUEST_USER = 'guest';
const GUEST_PASSWORD = 'guest';

@Controller('api/auth')
export class AuthController {
  constructor(private configService: ConfigService) {}

  @Post('login')
  async login(@Body() body: { username?: string; password?: string; brand?: string }) {
    const { username, password } = body;

    const adminUser = this.configService.get<string>('AUTH_ADMIN_USER') ?? 'admin';
    const adminPass = this.configService.get<string>('AUTH_ADMIN_PASSWORD') ?? '';
    const demoEnabled = this.configService.get<string>('AUTH_DEMO_ENABLED') === 'true';
    // Guest access is on unless an operator explicitly turns it off.
    const guestEnabled = this.configService.get<string>('AUTH_GUEST_ENABLED') !== 'false';

    const isAdmin = Boolean(adminPass) && username === adminUser && password === adminPass;
    const isDemo = demoEnabled && DEMO_USERS.includes(username ?? '');
    // The password is published, so an empty one is accepted too — the one-click
    // "Гостьовий вхід" button on the login screen sends exactly that.
    const isGuest =
      guestEnabled &&
      username === GUEST_USER &&
      (!password || password === GUEST_PASSWORD);

    if (isAdmin || isDemo || isGuest) {
      const role: SessionRole = isGuest
        ? 'GUEST'
        : username === 'okko'
          ? 'OKKO_ADMIN'
          : username === 'shell'
            ? 'SHELL_ADMIN'
            : 'SUPER_ADMIN';

      const name = isGuest
        ? 'Гостьовий перегляд'
        : username === 'okko'
          ? 'ОККО Менеджер'
          : username === 'shell'
            ? 'Shell Fleet Admin'
            : 'Адміністратор Veles Fuels';

      return {
        success: true,
        token: makeSessionToken(role),
        user: {
          username: username || 'admin',
          name,
          role,
          // A guest sees every brand — the restriction is on writing, not on reading.
          allowedBrands:
            username === 'okko'
              ? ['OKKO']
              : username === 'shell'
                ? ['SHELL']
                : ['ALL', 'OKKO', 'SHELL'],
          permissions: permissionsFor(role),
        },
      };
    }

    throw new UnauthorizedException('Невірне ім\'я користувача або пароль');
  }

  @Get('me')
  async me(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Токен відсутній');
    }

    const role = roleFromToken(authHeader) ?? 'SUPER_ADMIN';
    const isGuest = role === 'GUEST';

    return {
      authenticated: true,
      username: isGuest ? GUEST_USER : 'admin',
      name: isGuest ? 'Гостьовий перегляд' : 'Адміністратор Veles Fuels',
      role,
      permissions: permissionsFor(role),
    };
  }
}
