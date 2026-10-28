# API do AgroHacka

Servidor central do projeto, em NestJS, Prisma e PostgreSQL. Ele recebe as movimentações dos aparelhos, aplica a sincronização com recibos, reanalisa o estoque com o mesmo motor do app e envia os alertas urgentes pelo WhatsApp (Twilio).

A documentação completa está no [README principal](../README.md):
- **como executar:** seção 4.2, "Executando o Backend";
- **critérios dos alertas:** seção 5;
- **testes e limitações:** seção 7.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | Sobe a API em modo de desenvolvimento |
| `npm run build` | Compila para `dist/` |
| `npm run start:prod` | Executa a versão compilada |
| `npm test` | Testes unitários e de HTTP (Vitest) |
| `npm run test:sync` | Testes de integração com PostgreSQL descartável (precisa do Docker) |
| `npx tsx prisma/seed.ts` | Carrega a fazenda de demonstração com dados simulados, sem apagar nada |

## Onde está cada parte

| Pasta | Conteúdo |
| --- | --- |
| `src/stock-engine/` | Motor de análise (falta, vencimento, fora do padrão, consumo crescente, parado, excesso e curva ABC), igual ao do app (`parity.spec.ts`) |
| `src/sync/` | Sincronização com recibos e trava por fazenda |
| `src/stock/` | Reanálise e gravação dos alertas; base simulada de demonstração |
| `src/notifications/` | Envio dos alertas urgentes pelo WhatsApp |
| `src/auth/`, `src/devices/` | Login do gestor e pareamento dos operadores |
| `prisma/` | Esquema do banco, migrations e carga de demonstração |
