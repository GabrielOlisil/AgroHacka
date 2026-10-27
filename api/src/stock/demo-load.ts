import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import type { OfficialSeedDataset, SeedOrigin } from './official-seed.data';

export interface DemoLoadRejection {
  linha: number;
  ref?: string;
  motivo: string;
}

export interface DemoLoadReport {
  origem: SeedOrigin['tipo'];
  produtos: { validos: number; rejeitados: DemoLoadRejection[] };
  movimentacoes: { validas: number; rejeitadas: DemoLoadRejection[] };
  tratamentos: string[];
}

export interface PreparedProduct {
  ref: string;
  nome: string;
  categoria: string;
  unidadeMedida: string;
  estoqueMinimo: number;
  precoAquisicao: number | null;
  validade: Date | null;
  lote: string | null;
  fornecedor: string | null;
}

export interface PreparedMovement {
  productRef: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  dataMovimento: Date;
  responsavel: string;
  destino: string | null;
}

const UNIT_ALIASES: Record<string, string> = {
  sc: 'sc', saco: 'sc', sacos: 'sc', saca: 'sc', sacas: 'sc',
  l: 'L', lt: 'L', litro: 'L', litros: 'L',
  kg: 'kg', quilo: 'kg', quilos: 'kg', quilograma: 'kg', quilogramas: 'kg',
  t: 't', ton: 't', tonelada: 't', toneladas: 't',
  un: 'un', und: 'un', unidade: 'un', unidades: 'un',
  m: 'm', metro: 'm', metros: 'm',
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

// Validates the demo dataset row by row. Nothing is merged by name similarity:
// a repeated ref is rejected and differently named products stay separate.
export function prepareDemoLoad(dataset: OfficialSeedDataset): {
  products: PreparedProduct[];
  movements: PreparedMovement[];
  relatorio: DemoLoadReport;
} {
  const tratamentos: string[] = [];
  const products: PreparedProduct[] = [];
  const rejectedProducts: DemoLoadRejection[] = [];
  const seenRefs = new Set<string>();

  dataset.products.forEach((raw, index) => {
    const linha = index + 1;
    const ref = text(raw.ref);
    const reject = (motivo: string) => rejectedProducts.push({ linha, ref: ref || undefined, motivo });

    if (!ref) return reject('ref ausente');
    if (seenRefs.has(ref)) return reject(`ref duplicada: ${ref}`);
    seenRefs.add(ref);

    const nome = text(raw.nome);
    const categoria = text(raw.categoria);
    const unidadeBruta = text(raw.unidadeMedida);
    if (!nome) return reject('nome ausente');
    if (!categoria) return reject('categoria ausente');
    if (!unidadeBruta) return reject('unidade ausente');
    if (!Number.isFinite(raw.estoqueMinimo) || raw.estoqueMinimo < 0)
      return reject('estoque mínimo ausente ou negativo');

    let unidadeMedida = unidadeBruta;
    const alias = UNIT_ALIASES[unidadeBruta.toLowerCase()];
    if (!alias) {
      tratamentos.push(`Produto ${ref}: unidade "${unidadeBruta}" não reconhecida, mantida como está`);
    } else if (alias !== raw.unidadeMedida) {
      unidadeMedida = alias;
      tratamentos.push(`Produto ${ref}: unidade "${raw.unidadeMedida}" padronizada para "${alias}"`);
    }

    let precoAquisicao: number | null = null;
    if (raw.precoAquisicao == null) {
      tratamentos.push(`Produto ${ref}: preço ausente, valor financeiro fica desconhecido`);
    } else if (!Number.isFinite(raw.precoAquisicao) || raw.precoAquisicao < 0) {
      tratamentos.push(`Produto ${ref}: preço inválido descartado, valor financeiro fica desconhecido`);
    } else {
      precoAquisicao = raw.precoAquisicao;
    }

    let validade: Date | null = null;
    if (isValidDate(raw.validade)) validade = raw.validade;
    else if (raw.validade != null) tratamentos.push(`Produto ${ref}: validade inválida descartada`);

    products.push({
      ref,
      nome,
      categoria,
      unidadeMedida,
      estoqueMinimo: raw.estoqueMinimo,
      precoAquisicao,
      validade,
      lote: text(raw.lote) || null,
      fornecedor: text(raw.fornecedor) || null,
    });
  });

  const validRefs = new Set(products.map((p) => p.ref));
  const rejectedRefs = new Set(rejectedProducts.map((r) => r.ref));
  const movements: PreparedMovement[] = [];
  const rejectedMovements: DemoLoadRejection[] = [];

  dataset.movements.forEach((raw, index) => {
    const linha = index + 1;
    const ref = text(raw.productRef);
    const reject = (motivo: string) => rejectedMovements.push({ linha, ref: ref || undefined, motivo });

    if (!validRefs.has(ref))
      return reject(rejectedRefs.has(ref) ? 'produto rejeitado' : 'produto inexistente');
    if (raw.tipo !== 'ENTRADA' && raw.tipo !== 'SAIDA') return reject('tipo inválido');
    if (!Number.isFinite(raw.quantidade) || raw.quantidade <= 0)
      return reject('quantidade deve ser maior que zero');
    if (!isValidDate(raw.dataMovimento)) return reject('data inválida');

    let responsavel = text(raw.responsavel);
    if (!responsavel) {
      responsavel = 'Não informado';
      tratamentos.push(`Movimentação linha ${linha}: responsável ausente, registrado como "Não informado"`);
    }

    movements.push({
      productRef: ref,
      tipo: raw.tipo,
      quantidade: raw.quantidade,
      dataMovimento: raw.dataMovimento,
      responsavel,
      destino: text(raw.destino) || null,
    });
  });

  return {
    products,
    movements,
    relatorio: {
      origem: dataset.origem.tipo,
      produtos: { validos: products.length, rejeitados: rejectedProducts },
      movimentacoes: { validas: movements.length, rejeitadas: rejectedMovements },
      tratamentos,
    },
  };
}

// Creates the demo farm in a single transaction. It never deletes anything and
// does nothing when the demo gestor already exists, so it is safe to re-run.
export async function loadDemoFarm(
  prisma: PrismaClient,
  dataset: OfficialSeedDataset,
): Promise<{ status: 'CRIADA' | 'JA_EXISTE'; farmId: string | null; relatorio: DemoLoadReport }> {
  const { products, movements, relatorio } = prepareDemoLoad(dataset);

  const existing = await prisma.user.findUnique({ where: { email: dataset.gestor.email } });
  if (existing) return { status: 'JA_EXISTE', farmId: existing.farmId, relatorio };

  const senhaHash = await bcrypt.hash(dataset.gestor.senhaPura, 10);
  const farmId = await prisma.$transaction(async (tx) => {
    const farm = await tx.farm.create({
      data: {
        nome: dataset.farm.nome,
        gestorId: 'temp',
      },
    });
    const gestor = await tx.user.create({
      data: {
        nome: dataset.gestor.nome,
        email: dataset.gestor.email,
        senhaHash,
        telefone: dataset.gestor.telefone,
        role: dataset.gestor.role,
        farmId: farm.id,
      },
    });
    await tx.farm.update({ where: { id: farm.id }, data: { gestorId: gestor.id } });

    await tx.device.createMany({
      data: dataset.devices.map((device) => ({ farmId: farm.id, ...device })),
    });

    const productIds = new Map(products.map((p) => [p.ref, randomUUID()]));
    await tx.product.createMany({
      data: products.map(({ ref, ...product }) => ({ id: productIds.get(ref)!, farmId: farm.id, ...product })),
    });
    await tx.stockMovement.createMany({
      data: movements.map(({ productRef, ...movement }) => ({
        farmId: farm.id,
        productId: productIds.get(productRef)!,
        ...movement,
      })),
    });
    return farm.id;
  });

  return { status: 'CRIADA', farmId, relatorio };
}
