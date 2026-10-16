import { Controller, Post, Put, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncPayloadDto, HeartbeatDto } from './dto/sync.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async sync(@Body() dto: SyncPayloadDto) {
    return this.syncService.syncData(dto);
  }

  @Put('heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() dto: HeartbeatDto) {
    return this.syncService.updateHeartbeat(dto);
  }
}
