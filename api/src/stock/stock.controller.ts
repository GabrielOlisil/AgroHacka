import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { StockService } from './stock.service';

export class AnalyzeStockDto {
  farmId!: string;
}

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() dto: AnalyzeStockDto) {
    return this.stockService.analyzeStock(dto.farmId);
  }
}
