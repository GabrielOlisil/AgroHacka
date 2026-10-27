# AgroHacka — cliente Desktop e Mobile

Cliente Vue 3 + Tauri v2, com SQLite local e integração HTTP via `openapi-fetch`.
O contrato em `src/types/contract.d.ts` é gerado por `npm run openapi`, a partir
da API em execução. Não edite esse arquivo manualmente. A consulta de operadores
usa a rota `GET /devices` da API atualizada, sem alterar o gerador existente.

## Executar

Use Node.js 24 LTS e o ambiente Rust/Tauri já configurado no projeto:

```powershell
cd client
npm ci
npm run tauri:dev
```

`npm run dev` abre somente a interface no navegador. O armazenamento SQLite e os
backups exigem o processo Tauri; o cliente avisa quando não está nesse ambiente.

A URL HTTP vem de `VITE_API_URL`, lida pelo Vite: `.env.development` no
desenvolvimento, `.env.production` no build e `.env.test` nos testes. Esses arquivos
locais não são versionados; consulte `.env.example` para configurar seu ambiente.
Não é necessário editar `src/api/client.ts`. No CI, o workflow injeta a URL de
produção. Ela fica embutida no build: mudar um arquivo depois de instalar o app
não altera sua URL. `localhost` no Android aponta para o próprio celular.

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
- Migrations SQL usam LF, fixado por `client/.gitattributes`. O SQLx inclui
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
- Base da estimativa: exibe quantidade de retiradas e dias de calendário por
  insumo. Menos de 3 amostras indica base limitada, 3–4 intermediária e 5 ou mais
  ampliada. É uma heurística de amostragem, não confiança estatística nem garantia
  de duração; os limiares seguem a referência já existente no motor da API.
- Vencimento: saldo positivo, data de validade e consumo observado; atenção a
  sobras previstas em até 30 dias. Data vencida ou vencimento hoje é urgente.
- Anomalia: última saída de pelo menos três vezes a média de três ou mais
  retiradas anteriores da janela. Não implica fraude ou desperdício comprovado.
- Financeiro: saldo positivo × preço de aquisição informado. Preço ausente mantém
  valor desconhecido (`null`), não contribui ao subtotal e deixa o item sem classe
  ABC. Se houver saldo sem preço, a interface sinaliza capital/ABC parciais e
  quantos itens não estão valorados; sem qualquer preço conhecido para o saldo,
  apresenta valor indisponível, não R$ 0. Preço zero informado é válido.
- ABC: produtos ordenados pelo capital armazenado, com faixas acumuladas de
  80%, 95% e 100%; item que cruza uma faixa fica na faixa em que começou.
- Estoque parado: saldo positivo sem saída há pelo menos 30 dias.
- Excesso: autonomia observada acima de 90 dias, com aviso para considerar a
  sazonalidade. Os critérios são referências explícitas do protótipo.
- Saldos são agrupados por unidade, sem um total que misture litros e quilos.

As fórmulas locais estão isoladas no cliente. O alinhamento do caminho efetivamente
utilizado pelo serviço da API, incluindo unidades, parado/excesso e metadados
financeiros, permanece nas tarefas 2.4/10.3/10.4 do DEV 1. Não prometer paridade
total antes dessa validação. Esta entrega não modifica o backend nem o OpenAPI.

## Pareamento e backups

O gestor gera código e QR Code pelo endpoint existente. O operador pode digitar
o código, selecionar uma imagem QR ou usar a câmera quando a WebView oferecer
permissão e suporte. A leitura conecta automaticamente. Câmera e permissão foram
validadas pelo usuário no Motorola g75 5G com Android 16 em 26/10 (tarefa 3.5);
outros aparelhos ainda precisam de validação própria.

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

- **Sincronização exclusivamente pela internet:** decisão de 26/10; LAN está
  cancelada e não integra o backlog. O cliente deve enviar diretamente à API
  central, sem servidor no gestor, descoberta de IP ou fallback local. Os registros
  offline continuam no SQLite/outbox e são enviados ao reconectar. **5.7-A concluída
  no cliente:** removidos os helpers LAN, publicação de IP e script de firewall;
  sessões/QR legados ignoram esses campos. Endpoints e campos ainda existentes na
  API/contrato são pendências do DEV 1 (5.7-B/C). Não apagar dados locais nem
  regenerar tokens para atualizar. Ver `../ROADMAP_FINALIZACAO.md`.
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
- A pendência de aceite do DEV 2 no MVP é a validação offline no Android real
  (tarefa 5.2), adiada pelo usuário. O roteiro e os critérios estão em
  [VALIDACAO_OFFLINE.md](VALIDACAO_OFFLINE.md). Testes automatizados não comprovam
  esse aceite. Instalação limpa no Windows, APK instalado, câmera e WhatsApp
  real já foram registrados em `../tarefas.md`; isso não dispensa testar uma
  nova versão nos aparelhos. A extração do motor compartilhado e o cofre nativo
  continuam como evoluções, sem ampliar o escopo desta validação.

## Operadores pareados e recuperação do código

O gestor cria um pareamento em **Conectar operador** e pode voltar à aba
**Operadores**, buscar o nome e clicar em **Ver código**. É o mesmo código
original: consultar não cria outro dispositivo nem troca sua credencial.
**Ocultar código** recolhe a informação; atualizar a lista também a oculta.
Depois de gerar um pareamento com essa aba aberta, a listagem é atualizada.

Os registros vêm de `GET /devices`, autenticado com o JWT do gestor e limitado
à sua fazenda. A resposta não contém `deviceToken`; dispositivos inativos têm
código nulo. Códigos permitem conectar aparelhos e devem ser compartilhados
somente com os responsáveis. Não há edição, revogação ou rotação nesta tela.

A consulta exige API acessível. Falhas mostram um aviso sem apagar a sessão,
movimentações ou pendências offline. A lista não é salva no SQLite e usa
`no-store` no cliente e no servidor. O CRUD local separado foi substituído por
este fluxo; possíveis registros antigos em `app_config` não são utilizados
nem apagados. Nenhuma alteração de schema ou migration é necessária.

Testes específicos no desktop: `npm test -- tests/operators-http.spec.ts
tests/operators-panel.spec.ts tests/workspace.spec.ts tests/app.spec.ts`.
Na API: `npm test -- src/devices/devices.service.spec.ts
src/devices/devices.controller.spec.ts src/devices/devices.http.spec.ts`.
Cobrem validação do contrato, autorização, isolamento, ausência de credenciais
na resposta, consulta sem criação e a recuperação do mesmo código na interface.
Os testes HTTP da rota usam um repositório simulado, sem alterar PostgreSQL real;
isso não substitui a validação no aplicativo Tauri instalado.
