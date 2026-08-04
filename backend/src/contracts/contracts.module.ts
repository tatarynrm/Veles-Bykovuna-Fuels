import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { OkkoModule } from '../okko/okko.module';

@Module({
  imports: [OkkoModule],
  controllers: [ContractsController],
})
export class ContractsModule {}
