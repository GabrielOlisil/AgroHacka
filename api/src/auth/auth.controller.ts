import {
  Controller,
  Post,
  Patch,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, UpdateTelefoneDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Patch('telefone')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'authorization',
    required: true,
    description: 'JWT do gestor da fazenda.',
  })
  async updateTelefone(
    @Body() dto: UpdateTelefoneDto,
    @Headers('authorization') authorization?: string,
  ) {
    const identity = await this.authService.authenticateSync(authorization);
    if (identity.role !== 'GESTOR') throw new ForbiddenException();
    return this.authService.updateTelefone(identity.actorId, dto.telefone);
  }
}
