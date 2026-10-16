import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterDto, LoginDto, AuthResponse } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'agrohack-jwt-secret-key-2026';

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(dto.senha, saltRounds);

    return this.prisma.$transaction(async (tx: any) => {
      const farm = await tx.farm.create({
        data: {
          nome: dto.nomeFazenda,
          gestorId: 'temp',
        },
      });

      const user = await tx.user.create({
        data: {
          nome: dto.nome,
          email: dto.email,
          senhaHash,
          telefone: dto.telefone,
          role: 'GESTOR',
          farmId: farm.id,
        },
        include: {
          farm: true,
        },
      });

      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          farmId: farm.id,
        },
        this.jwtSecret,
        { expiresIn: '30d' },
      );

      return {
        accessToken,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          farmId: farm.id,
          farmNome: farm.nome,
        },
      };
    });
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        farm: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.senha, user.senhaHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        farmId: user.farmId,
      },
      this.jwtSecret,
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        farmId: user.farmId,
        farmNome: user.farm?.nome,
      },
    };
  }
}
