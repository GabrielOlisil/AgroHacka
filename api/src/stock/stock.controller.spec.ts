import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

describe('StockController', () => {
  let stockController: StockController;
  let stockService: any;

  beforeEach(() => {
    stockService = {
      analyzeStock: vi.fn(),
    };
    stockController = new StockController(stockService as StockService);
  });

  it('deve chamar analyzeStock com farmId correto', async () => {
    const mockReport = {
      resumo: { totalInsumos: 5 },
      curvaAbc: {},
      alertas: [],
    };

    stockService.analyzeStock.mockResolvedValue(mockReport);

    const result = await stockController.analyze({ farmId: 'farm-123' });

    expect(stockService.analyzeStock).toHaveBeenCalledWith('farm-123');
    expect(result).toEqual(mockReport);
  });
});
