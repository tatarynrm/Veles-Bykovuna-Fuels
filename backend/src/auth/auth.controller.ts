import { Controller, Post, Body, UnauthorizedException, Get, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEMO_USERS = ['okko', 'shell', 'demo'];

@Controller('api/auth')
export class AuthController {
  constructor(private configService: ConfigService) {}

  @Post('login')
  async login(@Body() body: { username?: string; password?: string; brand?: string }) {
    const { username, password } = body;

    const adminUser = this.configService.get<string>('AUTH_ADMIN_USER') ?? 'admin';
    const adminPass = this.configService.get<string>('AUTH_ADMIN_PASSWORD') ?? '';
    const demoEnabled = this.configService.get<string>('AUTH_DEMO_ENABLED') === 'true';

    const isAdmin = Boolean(adminPass) && username === adminUser && password === adminPass;
    const isDemo = demoEnabled && DEMO_USERS.includes(username ?? '');

    if (isAdmin || isDemo) {
      const role = username === 'okko' ? 'OKKO_ADMIN' : username === 'shell' ? 'SHELL_ADMIN' : 'SUPER_ADMIN';
      const token = `veles_session_${Date.now()}_${role}`;

      return {
        success: true,
        token,
        user: {
          username: username || 'admin',
          name: username === 'okko' ? 'ОККО Менеджер' : username === 'shell' ? 'Shell Fleet Admin' : 'Адміністратор Veles Fuels',
          role,
          allowedBrands: username === 'okko' ? ['OKKO'] : username === 'shell' ? ['SHELL'] : ['ALL', 'OKKO', 'SHELL']
        }
      };
    }

    throw new UnauthorizedException('Невірне ім\'я користувача або пароль');
  }

  @Get('me')
  async me(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Токен відсутній');
    }
    return {
      authenticated: true,
      username: 'admin',
      name: 'Адміністратор Veles Fuels',
      role: 'SUPER_ADMIN'
    };
  }
}
