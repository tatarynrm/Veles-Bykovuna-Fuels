import { Controller, Get } from '@nestjs/common';
import { OracleService } from './oracle.service';

@Controller('api/oracle')
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  /** GET /api/oracle/os → select kod, pip from os */
  @Get('os')
  async getOs() {
    if (!this.oracleService.isConfigured()) {
      return { configured: false, rows: [], error: 'Oracle не налаштовано (див. ORACLE_* у .env)' };
    }
    try {
      const rows = await this.oracleService.getOs();
      return { configured: true, count: rows.length, rows };
    } catch (error) {
      return { configured: true, rows: [], error: error.message };
    }
  }
}
