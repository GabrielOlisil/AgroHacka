import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [AuthModule, StockModule],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}

