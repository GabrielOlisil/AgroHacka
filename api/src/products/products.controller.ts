import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import {
  CreateProductDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto/products.dto';
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

  @Patch(':id')
  @ApiBearerAuth()
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: Request,
  ): Promise<ProductResponseDto> {
    return this.products.update(id, dto, await this.identity(request));
  }

  @Delete(':id')
  @ApiBearerAuth()
  async remove(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<ProductResponseDto> {
    return this.products.remove(id, await this.identity(request));
  }

  private identity(request: Request) {
    return this.auth.authenticateSync(
      request.get('authorization'),
      request.get('x-device-token'),
    );
  }
}
