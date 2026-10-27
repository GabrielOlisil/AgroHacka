import { PrismaClient } from '@prisma/client';
import { getOfficialSeedDataset } from '../src/stock/official-seed.data';
import { loadDemoFarm } from '../src/stock/demo-load';

const prisma = new PrismaClient();

async function main() {
  const dataset = getOfficialSeedDataset();
  console.log(`🌱 Carga da fazenda de demonstração (${dataset.origem.tipo})`);
  console.log(`   ${dataset.origem.descricao}`);

  // Não destrutiva: não apaga nada e não faz nada se o gestor de demonstração já existir.
  const { status, farmId, relatorio } = await loadDemoFarm(prisma, dataset);

  if (status === 'JA_EXISTE') {
    console.log(`ℹ️  ${dataset.gestor.email} já existe (fazenda ${farmId}); nada foi alterado.`);
  } else {
    console.log(`✅ Fazenda "${dataset.farm.nome}" criada (${farmId}).`);
    console.log(`- Gestor de teste: ${dataset.gestor.email} (senha: ${dataset.gestor.senhaPura})`);
    console.log(`- Operadores: ${dataset.devices.length}`);
  }

  console.log('📊 Relatório da validação:');
  console.log(`- Produtos válidos: ${relatorio.produtos.validos}, rejeitados: ${relatorio.produtos.rejeitados.length}`);
  console.log(`- Movimentações válidas: ${relatorio.movimentacoes.validas}, rejeitadas: ${relatorio.movimentacoes.rejeitadas.length}`);
  for (const r of [...relatorio.produtos.rejeitados, ...relatorio.movimentacoes.rejeitadas]) {
    console.log(`  ✗ linha ${r.linha}${r.ref ? ` (${r.ref})` : ''}: ${r.motivo}`);
  }
  for (const t of relatorio.tratamentos) console.log(`  • ${t}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro durante a carga da fazenda de demonstração:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
