export interface SeedFarm {
  nome: string;
}

export interface SeedGestor {
  nome: string;
  email: string;
  senhaPura: string;
  telefone: string;
  role: 'GESTOR';
}

export interface SeedDevice {
  nomeOperador: string;
  deviceToken: string;
  pairingCode: string;
  ativo: boolean;
}

export interface SeedProduct {
  ref: string;
  nome: string;
  categoria: string;
  unidadeMedida: string;
  estoqueMinimo: number;
  precoAquisicao?: number | null;
  validade?: Date | null;
  lote?: string;
  fornecedor?: string;
}

export interface SeedMovement {
  productRef: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  dataMovimento: Date;
  responsavel: string;
  destino: string;
}

export interface SeedOrigin {
  tipo: 'SIMULADO' | 'OFICIAL';
  descricao: string;
}

export interface OfficialSeedDataset {
  origem: SeedOrigin;
  farm: SeedFarm;
  gestor: SeedGestor;
  devices: SeedDevice[];
  products: SeedProduct[];
  movements: SeedMovement[];
}

export function getOfficialSeedDataset(): OfficialSeedDataset {
  const now = new Date();
  const d = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const farm: SeedFarm = {
    nome: 'Fazenda Modelo AgroHack',
  };

  const gestor: SeedGestor = {
    nome: 'José Produtor Rural',
    email: 'gestor@agrohack.com',
    senhaPura: 'agro1234',
    telefone: '+5569999999999',
    role: 'GESTOR',
  };

  const devices: SeedDevice[] = [
    {
      nomeOperador: 'Carlos Silva - Tratorista',
      deviceToken: 'tok_tratorista_01',
      pairingCode: 'AGRO-01',
      ativo: true,
    },
    {
      nomeOperador: 'Marcos Souza - Almoxarifado',
      deviceToken: 'tok_almoxarife_02',
      pairingCode: 'AGRO-02',
      ativo: true,
    },
  ];

  const products: SeedProduct[] = [
    // Insumo 1: Ureia (Cenário: Risco de Falta Iminente / Runout em ~3 dias)
    {
      ref: 'ureia',
      nome: 'Ureia Fertilizante 46% N',
      categoria: 'Fertilizantes',
      unidadeMedida: 'sc',
      estoqueMinimo: 40,
      precoAquisicao: 160.0,
      lote: 'L-UREIA-2026',
      fornecedor: 'Yara Fertilizantes',
      validade: d(365),
    },
    // Insumo 2: Trichoderma Biológico (Cenário: Risco de Vencimento antes do uso)
    {
      ref: 'trichoderma',
      nome: 'Trichoderma asperellum Biológico',
      categoria: 'Defensivos e biológicos',
      unidadeMedida: 'L',
      estoqueMinimo: 10,
      precoAquisicao: 220.0,
      lote: 'BIO-2026-X',
      fornecedor: 'Koppert Brasil',
      validade: d(12),
    },
    // Insumo 3: Óleo Diesel S10 (Cenário: Anomalia estatística de retirada)
    {
      ref: 'diesel',
      nome: 'Óleo Diesel S10',
      categoria: 'Combustíveis e lubrificantes',
      unidadeMedida: 'L',
      estoqueMinimo: 500,
      precoAquisicao: 6.2,
      fornecedor: 'Distribuidora Rondon',
    },
    // Insumo 4: Adubo Fosfatado MAP (Cenário: Curva ABC - Alto valor financeiro parado)
    {
      ref: 'map',
      nome: 'Adubo Fosfatado MAP 11-52-00',
      categoria: 'Fertilizantes',
      unidadeMedida: 't',
      estoqueMinimo: 5,
      precoAquisicao: 4200.0,
      lote: 'MAP-BAG-2026',
      fornecedor: 'Mosaic Fertilizantes',
      validade: d(500),
    },
    // Insumo 5: Calcário Dolomítico
    {
      ref: 'calcario',
      nome: 'Calcário Dolomítico PRNT 85%',
      categoria: 'Corretivos',
      unidadeMedida: 't',
      estoqueMinimo: 20,
      precoAquisicao: 120.0,
      fornecedor: 'Calcário Rondônia',
    },
    // Insumo 6: Semente Milho
    {
      ref: 'semente_milho',
      nome: 'Semente Milho Híbrido VT PRO 3',
      categoria: 'Sementes',
      unidadeMedida: 'sc',
      estoqueMinimo: 30,
      precoAquisicao: 850.0,
      validade: d(180),
      lote: 'SEM-MILHO-88',
      fornecedor: 'Pioneer Sementes',
    },
    // Insumo 7: Bicos de Pulverização
    {
      ref: 'bicos',
      nome: 'Bicos de Pulverização TeeJet Leque 110-02',
      categoria: 'Peças e manutenção',
      unidadeMedida: 'un',
      estoqueMinimo: 15,
      precoAquisicao: 35.0,
      fornecedor: 'AgroPeças Ariquemes',
    },
    // Insumo 8: Mangueira de Gotejamento (Materiais de Irrigação, Anexo III)
    {
      ref: 'gotejamento',
      nome: 'Mangueira de Gotejamento 16 mm',
      categoria: 'Materiais de Irrigação',
      unidadeMedida: 'm',
      estoqueMinimo: 200,
      precoAquisicao: 1.8,
      lote: 'IRR-GOT-2026',
      fornecedor: 'Irriga Norte',
    },
    // Insumo 9: Respirador Semi-Facial
    {
      ref: 'respirador',
      nome: 'Respirador Semi-Facial com Filtro Químico',
      categoria: 'EPI e materiais diversos',
      unidadeMedida: 'un',
      estoqueMinimo: 10,
      precoAquisicao: 78.0,
      fornecedor: 'Segurança Rural',
    },
  ];

  const movements: SeedMovement[] = [];

  // ── Cenário 1: Ureia ─────────────────────────────────────────────────────────
  // Entrada de 100 sacos há 30 dias
  movements.push({
    productRef: 'ureia',
    tipo: 'ENTRADA',
    quantidade: 100,
    dataMovimento: d(-30),
    responsavel: gestor.nome,
    destino: 'Almoxarifado Central',
  });

  // 17 saídas de 5 sacas nos últimos 20 dias (total 85 sacas retiradas -> saldo = 15 sacos)
  for (let i = 17; i >= 1; i--) {
    movements.push({
      productRef: 'ureia',
      tipo: 'SAIDA',
      quantidade: 5,
      dataMovimento: d(-i),
      responsavel: 'Carlos Silva - Tratorista',
      destino: 'Talhão 04 - Pastagem rotacionada',
    });
  }

  // ── Cenário 2: Trichoderma ──────────────────────────────────────────────────
  movements.push({
    productRef: 'trichoderma',
    tipo: 'ENTRADA',
    quantidade: 40,
    dataMovimento: d(-15),
    responsavel: gestor.nome,
    destino: 'Geladeira Inóculos Almoxarifado',
  });
  movements.push({
    productRef: 'trichoderma',
    tipo: 'SAIDA',
    quantidade: 1,
    dataMovimento: d(-7),
    responsavel: 'Carlos Silva - Tratorista',
    destino: 'Tratamento de Sementes',
  });

  // ── Cenário 3: Óleo Diesel S10 ───────────────────────────────────────────────
  movements.push({
    productRef: 'diesel',
    tipo: 'ENTRADA',
    quantidade: 5000,
    dataMovimento: d(-40),
    responsavel: gestor.nome,
    destino: 'Tanque Principal Fazenda',
  });
  for (let i = 15; i >= 3; i--) {
    movements.push({
      productRef: 'diesel',
      tipo: 'SAIDA',
      quantidade: 60,
      dataMovimento: d(-i),
      responsavel: 'Carlos Silva - Tratorista',
      destino: 'Abastecimento Trator John Deere 6110',
    });
  }
  // Pico anômalo de 950L
  movements.push({
    productRef: 'diesel',
    tipo: 'SAIDA',
    quantidade: 950,
    dataMovimento: d(-2),
    responsavel: 'Carlos Silva - Tratorista',
    destino: 'Destino não especificado / Retirada emergencial',
  });

  // ── Cenário 4: Adubo Fosfatado MAP (Curva ABC) ──────────────────────────────
  movements.push({
    productRef: 'map',
    tipo: 'ENTRADA',
    quantidade: 35,
    dataMovimento: d(-90),
    responsavel: gestor.nome,
    destino: 'Galpão 02 - Insumos Nobres',
  });

  // ── Demais categorias ───────────────────────────────────────────────────────
  movements.push(
    {
      productRef: 'calcario',
      tipo: 'ENTRADA',
      quantidade: 50,
      dataMovimento: d(-20),
      responsavel: gestor.nome,
      destino: 'Pátio de Calagem',
    },
    {
      productRef: 'semente_milho',
      tipo: 'ENTRADA',
      quantidade: 80,
      dataMovimento: d(-10),
      responsavel: gestor.nome,
      destino: 'Câmara Fria Sementes',
    },
    {
      productRef: 'bicos',
      tipo: 'ENTRADA',
      quantidade: 50,
      dataMovimento: d(-30),
      responsavel: 'Marcos Souza - Almoxarifado',
      destino: 'Oficina Mecânica',
    },
    {
      productRef: 'gotejamento',
      tipo: 'ENTRADA',
      quantidade: 1000,
      dataMovimento: d(-25),
      responsavel: 'Marcos Souza - Almoxarifado',
      destino: 'Galpão de Irrigação',
    },
    {
      productRef: 'gotejamento',
      tipo: 'SAIDA',
      quantidade: 150,
      dataMovimento: d(-8),
      responsavel: 'Carlos Silva - Tratorista',
      destino: 'Talhão 02 - Horta irrigada',
    },
    {
      productRef: 'respirador',
      tipo: 'ENTRADA',
      quantidade: 25,
      dataMovimento: d(-30),
      responsavel: 'Marcos Souza - Almoxarifado',
      destino: 'Armário EPI',
    },
  );

  return {
    origem: {
      tipo: 'SIMULADO',
      descricao:
        'Dados simulados criados pela equipe. Em 27/10/2026 a organização informou que não haverá base oficial e que as equipes devem criar seus dados.',
    },
    farm,
    gestor,
    devices,
    products,
    movements,
  };
}

export function validateOfficialDataset(dataset: OfficialSeedDataset): {
  valido: boolean;
  erros: string[];
} {
  const erros: string[] = [];

  if (!dataset.farm.nome) erros.push('Nome da fazenda é obrigatório');
  if (!dataset.gestor.email) erros.push('E-mail do gestor é obrigatório');
  if (dataset.devices.length < 2) erros.push('Mínimo de 2 operadores é obrigatório');

  const productRefs = new Set(dataset.products.map((p) => p.ref));
  for (const mov of dataset.movements) {
    if (!productRefs.has(mov.productRef)) {
      erros.push(`Movimentação referencia produto inexistente: ${mov.productRef}`);
    }
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}
