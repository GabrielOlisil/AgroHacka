import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { CreateProductDto, ProductResponseDto } from './dto/products.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @ApiBearerAuth()
  async create(
    @Body() dto: CreateProductDto,
    @Req() request: Request,
  ): Promise<ProductResponseDto> {
    return this.products.create(
      dto,
      await this.auth.authenticateSync(
        request.get('authorization'),
        request.get('x-device-token'),
      ),
    );
  }
}
