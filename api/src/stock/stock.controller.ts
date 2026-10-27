import {
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { AuthService } from '../auth/auth.service';

export class AnalyzeStockDto {
  farmId?: string;
}

@Controller('stock')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly auth: AuthService,
  ) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'authorization',
    required: false,
    description: 'JWT do gestor; alternativamente envie x-device-token.',
  })
  @ApiHeader({
    name: 'x-device-token',
    required: false,
    description: 'Credencial de operador ativo; não combine com Authorization.',
  })
  async analyze(
    @Body() dto: AnalyzeStockDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-token') deviceToken?: string,
  ) {
    const identity = await this.auth.authenticateSync(authorization, deviceToken);
    // The farm always comes from the verified identity; a body farmId is only a consistency check.
    if (dto?.farmId !== undefined && dto.farmId !== identity.farmId)
      throw new ForbiddenException();
    return this.stockService.analyzeStock(identity.farmId);
  }
}
