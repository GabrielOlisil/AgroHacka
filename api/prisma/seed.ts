import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Seed da Base de Dados Simulada (AgroHack 2026/2)...');

  // Limpa dados anteriores se existirem (para permitir re-execução limpa)
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
      nome: 'Fazenda Modelo AgroHack',
      gestorId: 'temp',
      localIp: '192.168.1.100',
      localPort: 3333,
    },
  });

  // 2. Cria o Gestor Oficial
  const senhaHash = await bcrypt.hash('agro1234', 10);
  const gestor = await prisma.user.create({
    data: {
      nome: 'José Produtor Rural',
      email: 'gestor@agrohack.com',
      senhaHash,
      telefone: '+5569999999999',
      role: 'GESTOR',
      farmId: farm.id,
    },
  });

  // Atualiza gestorId na fazenda
  await prisma.farm.update({
    where: { id: farm.id },
    data: { gestorId: gestor.id },
  });

  // 3. Cria Dispositivos de Operadores (com pareamento QR e código manual)
  await prisma.device.createMany({
    data: [
      {
        farmId: farm.id,
        nomeOperador: 'Carlos Silva - Tratorista',
        deviceToken: 'tok_tratorista_01',
        pairingCode: 'AGRO-01',
        ativo: true,
      },
      {
        farmId: farm.id,
        nomeOperador: 'Marcos Souza - Almoxarifado',
        deviceToken: 'tok_almoxarife_02',
        pairingCode: 'AGRO-02',
        ativo: true,
      },
    ],
  });

  // 4. Cria Produtos Cobrindo Todas as Categorias do Regulamento
  const now = new Date();
  const d = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Insumo 1: Ureia (Cenário: Risco de Falta Iminente / Runout em ~3 dias)
  const ureia = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Ureia Fertilizante 46% N',
      categoria: 'Fertilizantes',
      unidadeMedida: 'sc', // sacas de 50kg
      estoqueMinimo: 40,
      precoAquisicao: 160.0,
      lote: 'L-UREIA-2026',
      fornecedor: 'Yara Fertilizantes',
      validade: d(365),
    },
  });

  // Insumo 2: Trichoderma Biológico (Cenário: Risco de Vencimento antes do uso)
  const trichoderma = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Trichoderma asperellum Biológico',
      categoria: 'Defensivos e biológicos',
      unidadeMedida: 'L',
      estoqueMinimo: 10,
      precoAquisicao: 220.0,
      lote: 'BIO-2026-X',
      fornecedor: 'Koppert Brasil',
      validade: d(12), // vence daqui a 12 dias!
    },
  });

  // Insumo 3: Óleo Diesel S10 (Cenário: Anomalia estatística de retirada)
  const diesel = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Óleo Diesel S10',
      categoria: 'Combustíveis e lubrificantes',
      unidadeMedida: 'L',
      estoqueMinimo: 500,
      precoAquisicao: 6.2,
      fornecedor: 'Distribuidora Rondon',
    },
  });

  // Insumo 4: Adubo Fosfatado MAP (Cenário: Curva ABC - Alto valor financeiro parado / Excesso)
  const aduboMap = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Adubo Fosfatado MAP 11-52-00',
      categoria: 'Fertilizantes',
      unidadeMedida: 't', // toneladas
      estoqueMinimo: 5,
      precoAquisicao: 4200.0,
      lote: 'MAP-BAG-2026',
      fornecedor: 'Mosaic Fertilizantes',
      validade: d(500),
    },
  });

  // Outros insumos das demais categorias para base completa
  const calcario = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Calcário Dolomítico PRNT 85%',
      categoria: 'Corretivos',
      unidadeMedida: 't',
      estoqueMinimo: 20,
      precoAquisicao: 120.0,
      fornecedor: 'Calcário Rondônia',
    },
  });

  const sementeMilho = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Semente Milho Híbrido VT PRO 3',
      categoria: 'Sementes',
      unidadeMedida: 'sc',
      estoqueMinimo: 30,
      precoAquisicao: 850.0,
      validade: d(180),
      lote: 'SEM-MILHO-88',
      fornecedor: 'Pioneer Sementes',
    },
  });

  const bicosPulv = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Bicos de Pulverização TeeJet Leque 110-02',
      categoria: 'Peças e manutenção',
      unidadeMedida: 'un',
      estoqueMinimo: 15,
      precoAquisicao: 35.0,
      fornecedor: 'AgroPeças Ariquemes',
    },
  });

  const epiMascara = await prisma.product.create({
    data: {
      farmId: farm.id,
      nome: 'Respirador Semi-Facial com Filtro Químico',
      categoria: 'EPI e materiais diversos',
      unidadeMedida: 'un',
      estoqueMinimo: 10,
      precoAquisicao: 78.0,
      fornecedor: 'Segurança Rural',
    },
  });

  // 5. Gera Histórico de Movimentações Simulando os 4 Cenários Reais

  // Cenário 1: Ureia (Saldo inicial de 100 sacos, com saídas constantes de 5 sacas/dia até restar 15 sacos -> acaba em 3 dias!)
  await prisma.stockMovement.create({
    data: {
      farmId: farm.id,
      productId: ureia.id,
      tipo: 'ENTRADA',
      quantidade: 100,
      dataMovimento: d(-30),
      responsavel: 'José Produtor Rural',
      destino: 'Almoxarifado Central',
    },
  });

  // 17 saídas de 5 sacas nos últimos 20 dias (total 85 sacas retiradas -> saldo atual = 15 sacas)
  for (let i = 20; i >= 1; i--) {
    if (i % 2 === 0 || i === 1) {
      await prisma.stockMovement.create({
        data: {
          farmId: farm.id,
          productId: ureia.id,
          tipo: 'SAIDA',
          quantidade: 5,
          dataMovimento: d(-i),
          responsavel: 'Carlos Silva - Tratorista',
          destino: 'Talhão 04 - Pastagem rotacionada',
        },
      });
    }
  }

  // Cenário 2: Trichoderma (Entrada de 40 Litros, validade de 12 dias, consumo de apenas 1L por semana)
  await prisma.stockMovement.create({
    data: {
      farmId: farm.id,
      productId: trichoderma.id,
      tipo: 'ENTRADA',
      quantidade: 40,
      dataMovimento: d(-15),
      responsavel: 'José Produtor Rural',
      destino: 'Geladeira Inóculos Almoxarifado',
    },
  });
  await prisma.stockMovement.create({
    data: {
      farmId: farm.id,
      productId: trichoderma.id,
      tipo: 'SAIDA',
      quantidade: 1,
      dataMovimento: d(-7),
      responsavel: 'Carlos Silva - Tratorista',
      destino: 'Tratamento de Sementes',
    },
  });

  // Cenário 3: Óleo Diesel S10 (Consumo normal diário de 50 a 70L, e uma anomalia súbita de 950L)
  await prisma.stockMovement.create({
    data: {
      farmId: farm.id,
      productId: diesel.id,
      tipo: 'ENTRADA',
      quantidade: 5000,
      dataMovimento: d(-40),
      responsavel: 'José Produtor Rural',
      destino: 'Tanque Principal Fazenda',
    },
  });

  // Saídas normais diárias
  for (let i = 15; i >= 3; i--) {
    await prisma.stockMovement.create({
      data: {
        farmId: farm.id,
        productId: diesel.id,
        tipo: 'SAIDA',
        quantidade: 60,
        dataMovimento: d(-i),
        responsavel: 'Carlos Silva - Tratorista',
        destino: 'Abastecimento Trator John Deere 6110',
      },
    });
  }

  // Anomalia: retirada desproporcional há 2 dias
  await prisma.stockMovement.create({
    data: {
      farmId: farm.id,
      productId: diesel.id,
      tipo: 'SAIDA',
      quantidade: 950, // anomalia gritante em relação aos 60L habituais!
      dataMovimento: d(-2),
      responsavel: 'Carlos Silva - Tratorista',
      destino: 'Destino não especificado / Retirada emergencial',
    },
  });

  // Cenário 4: Adubo MAP (Curva ABC: Entrada de 35 toneladas a R$ 4.200/t = R$ 147.000,00 parado há 3 meses com zero saída)
  await prisma.stockMovement.create({
    data: {
      farmId: farm.id,
      productId: aduboMap.id,
      tipo: 'ENTRADA',
      quantidade: 35,
      dataMovimento: d(-90),
      responsavel: 'José Produtor Rural',
      destino: 'Galpão 02 - Insumos Nobres',
    },
  });

  // Movimentações das demais categorias
  await prisma.stockMovement.createMany({
    data: [
      {
        farmId: farm.id,
        productId: calcario.id,
        tipo: 'ENTRADA',
        quantidade: 50,
        dataMovimento: d(-20),
        responsavel: 'José Produtor Rural',
        destino: 'Pátio de Calagem',
      },
      {
        farmId: farm.id,
        productId: sementeMilho.id,
        tipo: 'ENTRADA',
        quantidade: 80,
        dataMovimento: d(-10),
        responsavel: 'José Produtor Rural',
        destino: 'Câmara Fria Sementes',
      },
      {
        farmId: farm.id,
        productId: bicosPulv.id,
        tipo: 'ENTRADA',
        quantidade: 50,
        dataMovimento: d(-30),
        responsavel: 'Marcos Souza - Almoxarifado',
        destino: 'Oficina Mecânica',
      },
      {
        farmId: farm.id,
        productId: epiMascara.id,
        tipo: 'ENTRADA',
        quantidade: 25,
        dataMovimento: d(-30),
        responsavel: 'Marcos Souza - Almoxarifado',
        destino: 'Armário EPI',
      },
    ],
  });

  console.log('✅ Seed finalizado com sucesso!');
  console.log('📊 Resumo da Base Simulada:');
  console.log(`- Fazenda: ${farm.nome}`);
  console.log(`- Gestor de Teste: ${gestor.email} (senha: agro1234)`);
  console.log('- 8 Insumos com 4 Cenários de Análise Agronômica embutidos:');
  console.log('   1. Risco de Falta (Ureia acaba em ~3 dias)');
  console.log('   2. Risco de Vencimento (Trichoderma vence em 12 dias com consumo lento)');
  console.log('   3. Anomalia de Consumo (Retirada atípica de 950L de Diesel S10)');
  console.log('   4. Capital Imobilizado / Curva ABC (R$ 147.000 em MAP parado)');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o Seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
