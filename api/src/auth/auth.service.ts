import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { RegisterDto, LoginDto, AuthResponse } from './dto/auth.dto';
import { normalizeWhatsappNumber } from '../notifications/whatsapp-number';

export interface SyncIdentity {
  actorId: string;
  farmId: string;
  role: 'GESTOR' | 'OPERADOR';
  nome: string;
  deviceId?: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret =
    process.env.JWT_SECRET || 'agrohack-jwt-secret-key-2026';

  constructor(private readonly prisma: PrismaService) {}

  async authenticateSync(
    authorization?: string,
    deviceToken?: string,
  ): Promise<SyncIdentity> {
    if (authorization && deviceToken)
      throw new UnauthorizedException('Use somente uma credencial.');
    if (deviceToken) {
      const device = await this.prisma.device.findUnique({
        where: { deviceToken },
      });
      if (!device?.ativo)
        throw new UnauthorizedException('Dispositivo inválido ou inativo.');
      return {
        actorId: device.id,
        deviceId: device.id,
        farmId: device.farmId,
        role: 'OPERADOR',
        nome: device.nomeOperador,
      };
    }
    const token = /^Bearer (\S+)$/i.exec(authorization ?? '')?.[1];
    if (!token)
      throw new UnauthorizedException(
        'Credencial de sincronização obrigatória.',
      );
    let claims: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string')
        throw new Error('Invalid claims');
      claims = decoded;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
    });
    if (
      !user ||
      user.role !== 'GESTOR' ||
      !user.farmId ||
      user.farmId !== claims.farmId
    )
      throw new UnauthorizedException('Sessão sem acesso à fazenda.');
    return {
      actorId: user.id,
      farmId: user.farmId,
      role: 'GESTOR',
      nome: user.nome,
    };
  }

  async updateTelefone(
    userId: string,
    telefone: unknown,
  ): Promise<{ telefone?: string }> {
    const normalized = normalizeWhatsappNumber(telefone);
    await this.prisma.user.update({
      where: { id: userId },
      data: { telefone: normalized },
    });
    return normalized ? { telefone: normalized } : {};
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const telefone = normalizeWhatsappNumber(dto.telefone);
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
          telefone: telefone ?? undefined,
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
          ...(user.telefone ? { telefone: user.telefone } : {}),
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

    const rawPassword = dto.senha || dto.password;
    if (!rawPassword) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(rawPassword, user.senhaHash);

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
        ...(user.telefone ? { telefone: user.telefone } : {}),
      },
    };
  }
}
