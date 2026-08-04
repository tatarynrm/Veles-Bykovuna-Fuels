import { Module } from '@nestjs/common';
import { ShellController } from './shell.controller';
import { ShellApiService } from './shell-api.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [ShellController],
  providers: [ShellApiService],
  exports: [ShellApiService],
})
export class ShellModule {}
