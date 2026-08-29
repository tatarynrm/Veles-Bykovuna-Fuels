import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OracleController } from './oracle.controller';
import { OracleService } from './oracle.service';
import { OsRepository } from './os.repository';

@Module({
  imports: [ConfigModule],
  controllers: [OracleController],
  // OracleService is the generic access layer (exported for other repositories);
  // OsRepository owns this module's own `os` SQL.
  providers: [OracleService, OsRepository],
  exports: [OracleService],
})
export class OracleModule {}
