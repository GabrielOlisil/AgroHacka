import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { getOfficialSeedDataset } from '../src/stock/official-seed.data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Seed da Base de Dados Oficial (AgroHack 2026/2)...');

  const dataset = getOfficialSeedDataset();

  // Limpa dados anteriores para permitir re-execução idempotente
  await prisma.syncReceipt.deleteMany({});
  await prisma.syncLog.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.farm.deleteMany({});

  // 1. Cria a Fazenda Modelo
  const farm = await prisma.farm.create({
    data: {
      nome: dataset.farm.nome,
      gestorId: 'temp',
      localIp: dataset.farm.localIp,
      localPort: dataset.farm.localPort,
    },
  });

  // 2. Cria o Gestor Oficial
  const senhaHash = await bcrypt.hash(dataset.gestor.senhaPura, 10);
  const gestor = await prisma.user.create({
    data: {
      nome: dataset.gestor.nome,
      email: dataset.gestor.email,
      senhaHash,
      telefone: dataset.gestor.telefone,
      role: dataset.gestor.role,
      farmId: farm.id,
    },
  });

  // Atualiza gestorId na fazenda
  await prisma.farm.update({
    where: { id: farm.id },
    data: { gestorId: gestor.id },
  });

  // 3. Cria Dispositivos dos Operadores
  for (const device of dataset.devices) {
    await prisma.device.create({
      data: {
        farmId: farm.id,
        nomeOperador: device.nomeOperador,
        deviceToken: device.deviceToken,
        pairingCode: device.pairingCode,
        ativo: device.ativo,
      },
    });
  }

  // 4. Cria Produtos do Dataset Oficial
  const productMap = new Map<string, string>(); // ref -> uuid
  for (const prod of dataset.products) {
    const created = await prisma.product.create({
      data: {
        farmId: farm.id,
        nome: prod.nome,
        categoria: prod.categoria,
        unidadeMedida: prod.unidadeMedida,
        estoqueMinimo: prod.estoqueMinimo,
        precoAquisicao: prod.precoAquisicao,
        validade: prod.validade,
        lote: prod.lote,
        fornecedor: prod.fornecedor,
      },
    });
    productMap.set(prod.ref, created.id);
  }

  // 5. Cria Histórico de Movimentações
  for (const mov of dataset.movements) {
    const productId = productMap.get(mov.productRef);
    if (!productId) continue;

    await prisma.stockMovement.create({
      data: {
        farmId: farm.id,
        productId,
        tipo: mov.tipo,
        quantidade: mov.quantidade,
        dataMovimento: mov.dataMovimento,
        responsavel: mov.responsavel,
        destino: mov.destino,
      },
    });
  }

  console.log('✅ Base Oficial carregada com sucesso!');
  console.log('📊 Resumo da Base Oficial:');
  console.log(`- Fazenda: ${farm.nome}`);
  console.log(`- Gestor de Teste: ${dataset.gestor.email} (senha: ${dataset.gestor.senhaPura})`);
  console.log(`- Dispositivos: ${dataset.devices.length} operadores pareados`);
  console.log(`- Insumos: ${dataset.products.length} produtos cadastrados`);
  console.log(`- Movimentações: ${dataset.movements.length} registros históricos cobrindo os 4 cenários.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o Seed da Base Oficial:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
