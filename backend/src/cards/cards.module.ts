import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { OkkoModule } from '../okko/okko.module';
import { ShellModule } from '../shell/shell.module';

@Module({
  imports: [OkkoModule, ShellModule],
  controllers: [CardsController],
})
export class CardsModule {}
