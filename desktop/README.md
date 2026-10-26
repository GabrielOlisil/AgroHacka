# AgroHacka — cliente Desktop e Mobile

Cliente Vue 3 + Tauri v2, com SQLite local e integração HTTP via `openapi-fetch`.
O contrato existente em `src/types/contract.d.ts` é usado sem alterações. A API e
o script que gera o OpenAPI não foram modificados por esta implementação.

## Executar

Use Node.js 24 LTS e o ambiente Rust/Tauri já configurado no projeto:

```powershell
cd desktop
npm ci
npm run tauri:dev
```

`npm run dev` abre somente a interface no navegador. O armazenamento SQLite e os
backups exigem o processo Tauri; o cliente avisa quando não está nesse ambiente.

A URL HTTP é uma constante explícita em `src/api/client.ts`: inicialmente
`http://localhost:3000`, como o script OpenAPI que já existia. Para acessar a VPS
ou testar no Android, ajuste essa constante para o endereço acessível pelo
aparelho. `localhost` no celular aponta para o próprio celular. Não foram criadas
variáveis de ambiente.

O primeiro cadastro, login ou pareamento exige a API. Após obter a sessão e
sincronizar o catálogo, leituras, movimentações e análises funcionam offline.
Uma fazenda nova sem produtos depende do catálogo disponibilizado pelo backend;
o endpoint atual de sincronização não recebe cadastros de produtos.

## Testar

```powershell
npm test
npm run check
npm run build
cd src-tauri
cargo test --test storage
```

Os testes Vitest usam SQLite real via `node:sqlite` para verificar transações,
isolamento por fazenda, fila pendente e convergência de dois aparelhos. O servidor
HTTP é simulado: esses testes não alteram a base da API. Há também testes dos
fluxos Vue, regras de análise, validação HTTP e pareamento. Os testes Rust fazem
backup e restauração de bancos temporários reais.

## Interface e revisão visual

A interface segue `design-system.md`: tokens de cores e espaçamento, cantos
retos, controles compactos e ícones Lucide com traço de 1,75. A fonte Inter é
empacotada localmente, sem depender de um serviço externo no modo offline.
Navegação e seletores expõem seu estado aos leitores de tela e têm foco visível.

Para revisar as telas sem API, SQLite ou dados reais, execute `npm run dev` e
abra `/tests/visual-preview.html`. Essa página usa dados simulados e não entra
no build de produção. Os parâmetros `?profile=guest` e `?profile=operador`
permitem conferir boas-vindas e o painel do operador; sem parâmetro, abre o
gestor. A revisão responsiva no navegador não substitui os testes em WebView
e Android real.

## Persistência e sincronização

- O plugin SQL aplica a migration `src-tauri/migrations/001_offline.sql`.
- Migrations SQL usam LF, fixado por `desktop/.gitattributes`. O SQLx inclui
  quebras de linha no checksum: trocar LF por CRLF pode causar o erro
  `migration 1 was previously applied but has been modified` mesmo com SQL
  equivalente. O teste de regressão preserva o checksum original e verifica
  checkouts com diferentes configurações de `core.autocrlf`. Nunca edite uma
  migration aplicada; mudanças no schema devem entrar em uma nova versão.
- As tabelas são `products`, `movements`, `alerts`, `sync_outbox` e `app_config`.
- Produtos e movimentações preservam os IDs da API e ficam isolados por fazenda.
- Uma movimentação local recebe UUID, responsável da sessão e uma entrada na
  outbox, gravados juntos em uma única transação SQLx no processo Rust.
- Retiradas simultâneas neste cliente são serializadas antes da verificação de
  saldo. Quantidades nulas, negativas, não finitas, datas impossíveis/futuras e
  produtos de outra fazenda são rejeitados. Datas remotas são preservadas.
- A sessão persiste no SQLite. Senhas não são armazenadas. Expiração/rejeição de
  token pela API não apaga a sessão offline, os registros ou a fila local.
- O cliente sincroniza manualmente, ao recuperar conexão e a cada 30 segundos
  enquanto o aplicativo estiver aberto. Falhas preservam as pendências.
- A API recebe `protocolVersion: 2` e até 100 `pendingMovements`. O cliente exige
  recibos individuais completos, únicos e compatíveis com os IDs enviados;
  `syncedCount` sozinho não confirma nada. Dados, recibos, revisão e horário da
  última rodada são aplicados juntos. Downloads não geram outbox.
- O ID do rascunho persiste em `app_config` antes do salvamento. Retries do mesmo
  ID não criam outro fato; o workspace bloqueia salvamentos simultâneos e conserva
  o ID capturado se a resposta nativa falhar. A migration 001 não foi alterada.
- Recusas definitivas guardam tentativa e motivo para revisão, saindo da fila de
  reenvio e do saldo provisório. Não há exclusão silenciosa da tentativa nem tela
  que autorize estorno. A interface distingue saldo confirmado conhecido e local
  provisório e sinaliza déficit consolidado sem zerá-lo.
- Até o backend oferecer um cursor seguro, o cliente **não envia
  `lastSyncTimestamp`**. Baixa o conjunto completo e incorpora por ID. O horário
  da última sincronização é informativo. Isso evita a janela de perda do
  timestamp atualmente gerado depois das consultas da API.
- Pendências criadas durante uma requisição ficam para o próximo lote. Edições
  de movimentações confirmadas e exclusões não são oferecidas pela interface.

## Análise local

O motor puro está em `src/offline/analysis.ts` e recebe uma data de referência
para permitir testes determinísticos. O cliente não precisa de `/stock/analyze`
para atualizar os resultados.

- Consumo: saídas dos últimos 30 dias de calendário UTC, com média desde a
  primeira amostra da janela até a referência, incluindo dias sem saída.
- Duração: saldo positivo dividido pelo consumo diário; sem consumo observado,
  a previsão permanece indisponível. Baixo estoque também considera o mínimo.
- Vencimento: saldo positivo, data de validade e consumo observado; atenção a
  sobras previstas em até 30 dias. Data vencida ou vencimento hoje é urgente.
- Anomalia: última saída de pelo menos três vezes a média de três ou mais
  retiradas anteriores da janela. Não implica fraude ou desperdício comprovado.
- Financeiro: saldo positivo × preço de aquisição informado. Preço ausente
  aparece como desconhecido e não acrescenta valor ao total.
- ABC: produtos ordenados pelo capital armazenado, com faixas acumuladas de
  80%, 95% e 100%; item que cruza uma faixa fica na faixa em que começou.
- Estoque parado: saldo positivo sem saída há pelo menos 30 dias.
- Excesso: autonomia observada acima de 90 dias, com aviso para considerar a
  sazonalidade. Os critérios são referências explícitas do protótipo.
- Saldos são agrupados por unidade, sem um total que misture litros e quilos.

As fórmulas locais estão isoladas no cliente: o cálculo temporal do motor atual
da API usa outro critério (média por registro). O DEV 1 precisa alinhar as regras
ou extrair o pacote compartilhado antes de prometer resultados idênticos nas
duas pontas. As alterações atuais de backend limitam-se à sincronização e sua autenticação.

## Pareamento e backups

O gestor gera código e QR Code pelo endpoint existente. O operador pode digitar
o código, selecionar uma imagem QR ou usar a câmera quando a WebView oferecer
permissão e suporte. A câmera ainda exige validação em aparelhos reais.

O SQLite fica no diretório de configuração do aplicativo, conforme o plugin
SQL. Os snapshots ficam na subpasta `backups` desse diretório. Há no máximo uma
cópia diária; uma manutenção periódica cria a cópia do novo dia enquanto a sessão
estiver aberta e remove cópias diárias com mais de sete dias de calendário.

A restauração verifica a integridade e as tabelas esperadas, cria antes um
snapshot `pre-restore-*` e repõe os dados em uma transação. A sessão atual é
preservada. A interface pede confirmação: movimentações posteriores ao backup
saem do banco ativo, mas permanecem na cópia de recuperação. Restaurar o banco
local **não desfaz dados já confirmados na API**; a próxima sincronização pode
baixá-los novamente.

## Pendências para integração completa

- O servidor LAN no aparelho gestor, mDNS, heartbeat do gestor e encaminhamento
  LAN → nuvem não estão implementados. Existe um helper de fallback testado,
  mas ele não é ativado como se o gestor já tivesse um servidor HTTP.
- O backend desta branch implementa autenticação de `/sync`, recibos individuais
  e conflitos imutáveis. Exige a atualização aditiva do banco descrita em
  `../api/SYNC.md`, ainda não aplicada a bancos reais. Cursor seguro, tombstones,
  referências físicas e resolução auditada de conflitos continuam pendentes.
- A API atualizada devolve o token também por código manual. Sessões antigas sem
  credencial precisam reconectar; erro de autenticação não apaga pendências.
- O SQLite e os snapshots não estão criptografados. A senha de login nunca é
  persistida, mas os tokens ficam no diretório local do aplicativo. Proteção por
  cofre nativo é uma pendência antes de tratar o armazenamento como seguro.
- O fluxo HTTP da API real com PostgreSQL descartável e dois SQLite é testado por
  `npm run test:sync` na pasta `api`. Isso não substitui testes no dispositivo.
- Ainda faltam a extração do motor compartilhado,
  WhatsApp ponta a ponta, validação física offline/câmera, instalador/firewall e
  empacotamento Android.
