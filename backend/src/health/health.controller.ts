import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Lightweight liveness + configuration probe. Because every vendor call swallows
 * upstream failures and returns an empty array (so the UI degrades to zeroed KPIs
 * rather than erroring), a dead or unconfigured vendor is otherwise invisible from
 * the outside. This endpoint makes "which vendor is even wired up" explicit.
 *
 * It reports **configuration** (are the env keys present), not live reachability —
 * it does no upstream calls, so it is cheap and safe to poll. GET, so the guest
 * ReadOnlyGuard allows it.
 */
@Controller('api/health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly config: ConfigService) {}

  private has(key: string): boolean {
    return Boolean(this.config.get<string>(key));
  }

  @Get()
  health() {
    const oracleConnect =
      this.has('ORACLE_CONNECT_STRING') || this.has('ORACLE_CONNECTION_STRING');

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      vendors: {
        okko: { configured: this.has('OKKO_API_KEY') },
        shell: {
          configured: this.has('SHELL_API_KEY') && (this.has('SHELL_SECRET') || this.has('SHELL_BASIC_AUTH')),
        },
        ruptela: { configured: this.has('RUPTELA_API_KEY') },
        novaposhta: { configured: this.has('NOVAPOSHTA_API_KEY') },
        oracle: {
          configured: this.has('ORACLE_USER') && this.has('ORACLE_PASSWORD') && oracleConnect,
        },
      },
    };
  }
}
