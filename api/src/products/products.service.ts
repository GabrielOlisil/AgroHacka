import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';
import type { SyncIdentity } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, ProductResponseDto } from './dto/products.dto';

const fields = new Set([
  'id',
  'nome',
  'categoria',
  'unidadeMedida',
  'estoqueMinimo',
  'precoAquisicao',
  'validade',
  'lote',
  'fornecedor',
]);
// Same canonical units as the existing demo loader. Unknown units remain text;
// no conversion between dimensions or inferred opening movement occurs here.
const unitAliases = new Map<string, string>([
  ...['sc', 'saco', 'sacos', 'saca', 'sacas'].map((s): [string, string] => [
    s,
    'sc',
  ]),
  ...['l', 'lt', 'litro', 'litros'].map((s): [string, string] => [s, 'L']),
  ...['kg', 'quilo', 'quilos', 'quilograma', 'quilogramas'].map(
    (s): [string, string] => [s, 'kg'],
  ),
  ...['t', 'ton', 'tonelada', 'toneladas'].map((s): [string, string] => [
    s,
    't',
  ]),
  ...['un', 'und', 'unidade', 'unidades'].map((s): [string, string] => [
    s,
    'un',
  ]),
  ...['m', 'metro', 'metros'].map((s): [string, string] => [s, 'm']),
]);

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new BadRequestException(`${field} deve ser texto não vazio.`);
  return value.trim().normalize('NFC');
}

function nonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new BadRequestException(
      `${field} deve ser número finito maior ou igual a zero.`,
    );
  return value;
}

function canonical(dto: CreateProductDto) {
  if (
    !dto ||
    typeof dto !== 'object' ||
    Array.isArray(dto) ||
    Object.keys(dto).some((key) => !fields.has(key))
  )
    throw new BadRequestException('Campos de produto inválidos.');
  if (
    typeof dto.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      dto.id,
    )
  )
    throw new BadRequestException('id deve ser um UUID válido.');
  let validade: Date | null = null;
  if (dto.validade != null) {
    if (
      typeof dto.validade !== 'string' ||
      !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(dto.validade)
    )
      throw new BadRequestException(
        'validade deve ser uma data válida em YYYY-MM-DD.',
      );
    validade = new Date(`${dto.validade}T00:00:00.000Z`);
    if (
      !Number.isFinite(validade.getTime()) ||
      validade.toISOString().slice(0, 10) !== dto.validade
    )
      throw new BadRequestException(
        'validade deve ser uma data válida em YYYY-MM-DD.',
      );
  }
  const unit = text(dto.unidadeMedida, 'unidadeMedida');
  return {
    id: dto.id.toLowerCase(),
    nome: text(dto.nome, 'nome'),
    categoria: text(dto.categoria, 'categoria'),
    unidadeMedida: unitAliases.get(unit.toLowerCase()) ?? unit,
    estoqueMinimo: nonNegative(dto.estoqueMinimo, 'estoqueMinimo'),
    precoAquisicao:
      dto.precoAquisicao == null
        ? null
        : nonNegative(dto.precoAquisicao, 'precoAquisicao'),
    validade,
    lote: dto.lote == null ? null : text(dto.lote, 'lote'),
    fornecedor:
      dto.fornecedor == null ? null : text(dto.fornecedor, 'fornecedor'),
  };
}

function serialize(p: Product): ProductResponseDto {
  return {
    id: p.id,
    farmId: p.farmId,
    nome: p.nome,
    categoria: p.categoria,
    unidadeMedida: p.unidadeMedida,
    estoqueMinimo: p.estoqueMinimo,
    precoAquisicao: p.precoAquisicao,
    validade: p.validade?.toISOString() ?? null,
    lote: p.lote,
    fornecedor: p.fornecedor,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function conflict(): ConflictException {
  // Identical message for a local payload mismatch and a global UUID collision.
  return new ConflictException(
    'Identificador indisponível para este cadastro. Nenhum produto foi alterado.',
  );
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateProductDto,
    identity: SyncIdentity,
  ): Promise<ProductResponseDto> {
    if (!identity || identity.role !== 'GESTOR' || !identity.farmId)
      throw new ForbiddenException('Somente gestores podem cadastrar insumos.');
    const data = canonical(dto);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Match the sync writer's lock and isolation level across API instances.
          const farms = await tx.$queryRawUnsafe<{ id: string }[]>(
            'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
            identity.farmId,
          );
          if (!farms.length) throw new ForbiddenException();
          const existing = await tx.product.findFirst({
            where: { id: data.id, farmId: identity.farmId },
          });
          if (existing) {
            const same =
              existing.nome === data.nome &&
              existing.categoria === data.categoria &&
              existing.unidadeMedida === data.unidadeMedida &&
              existing.estoqueMinimo === data.estoqueMinimo &&
              existing.precoAquisicao === data.precoAquisicao &&
              existing.validade?.getTime() === data.validade?.getTime() &&
              existing.lote === data.lote &&
              existing.fornecedor === data.fornecedor;
            if (!same) throw conflict();
            return serialize(existing);
          }
          return serialize(
            await tx.product.create({
              data: { ...data, farmId: identity.farmId },
            }),
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10000,
          timeout: 20000,
        },
      );
    } catch (error) {
      // Global primary key also arbitrates simultaneous requests in other farms.
      // Catch outside the aborted transaction; never read foreign product data.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw conflict();
      throw error;
    }
  }
}
