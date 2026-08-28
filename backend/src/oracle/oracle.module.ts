import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OracleController } from './oracle.controller';
import { OracleService } from './oracle.service';

@Module({
  imports: [ConfigModule],
  controllers: [OracleController],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
