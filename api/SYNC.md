# Sincronização cloud — protocolo 2

Implementação na branch `codex/offline-stock-sync`, criada da `dev`. A política
aprovada preserva retiradas reais e sinaliza déficit: duas saídas de 70 L e 50 L
sobre 100 L produzem saldo −20 L, não descarte silencioso de uma delas.

## Atualização do banco e contrato

Não foi aplicada nenhuma alteração ao PostgreSQL de desenvolvimento ou produção.
Antes de usar este endpoint atualizado com um banco existente:

1. Faça backup e confira explicitamente o banco de destino.
2. Aplique uma única vez `prisma/sync-migrations/002_sync_receipts.sql` pelo
   procedimento de administração do banco. É uma adição à estrutura existente;
   não use reset, `db push` destrutivo ou exclusão de movimentações para atualizar.
   A pasta `sync-migrations` **não** é executada por `prisma migrate deploy`.
3. Execute `npx prisma generate`, compile e reinicie a API.
4. Com a API atualizada disponível em `localhost:3000`, gere o contrato pelo
   fluxo existente: `cd ../client` e `npm run openapi`. Não edite os tipos à mão.

A tabela `sync_receipts` armazena fazenda, ID, autor verificado, hash versionado
e decisão JSON. Não apague recibos ao compactar backups: IDs antigos podem voltar.
Esta mudança não introduz nem modifica arquivos de ambiente.

## Autenticação e processamento

`POST /sync` exige **uma** credencial: `Authorization: Bearer <JWT>` do gestor
ou `X-Device-Token` de operador ativo. A fazenda e o nome vêm da identidade
consultada no servidor. Produto e dispositivo do body são confrontados com ela.
JWT expirado ou dispositivo revogado retornam 401; o cliente conserva sua outbox.
Pareamentos só podem ser emitidos pelo gestor da fazenda; a conexão por código
manual agora também devolve o token do dispositivo. Sessões manuais antigas sem
token precisam reconectar. A sincronização é somente pela internet: desde a
tarefa 5.7 não há heartbeat nem registro de IP local, e pareamento e conexão não
devolvem IP/porta.

Um lote contém `protocolVersion: 2` e até 100 movimentações. Não há conversão de
unidades: a quantidade refere-se à unidade do produto. Datas trafegam em ISO.
IDs repetidos/ausentes, versão desconhecida e envelope inválido recusam o lote.

Sob lock da linha da fazenda no PostgreSQL, a transação grava movimento imutável,
recibo e log. Falha de infraestrutura reverte a transação. O hash inclui campos
imutáveis normalizados e autor verificado, não o nome ou `updatedAt` do cliente.

- `ACCEPTED`: fato confirmado, incluindo seu conteúdo canônico.
- Retry com mesmo ID/conteúdo/autor: exatamente a decisão durável anterior.
- `ID_PAYLOAD_CONFLICT`: ID já usado com outro conteúdo/autor, sem editar o evento.
- `VALIDATION_REJECTED`: tentativa inválida ou produto fora do escopo; sem efeito
  confirmado, com recibo definitivo para revisão local.

Movimentos legados ainda sem recibo podem ser reconhecidos por ID e conteúdo
equivalente, preservando o registro original. Não há prova retroativa de autoria
para esses registros; os novos recibos não devem ser tratados como essa prova.

## Download e cliente

Depois do commit, produtos e movimentos são lidos juntos em `REPEATABLE READ`.
O retorno é um **snapshot completo**, não um delta. `serverTimestamp` informa a
última rodada; não é cursor. `lastSyncTimestamp` legado não filtra o download.
O cliente valida os recibos por ID e aplica dados, revisões, remoção da outbox e
horário de sincronização na mesma transação SQLite. Novas pendências não enviadas
continuam locais. Um lote de 100 não confirma as demais pendências: ficam para
as rodadas seguintes. Respostas antigas sem recibos são recusadas pelo cliente.

Publique servidor e cliente coordenadamente. A resposta 2 substitui os campos
legados `alerts`/`resumo` por recibos e divergências; a análise local continua
imediata e `/stock/analyze` permanece separado. Não há garantia de compatibilidade
com clientes antigos, que não sabem encaminhar conflitos por item para revisão.

## Testes reproduzíveis

Na pasta `api`, com dependências de `api` **e** `client` instaladas, Node com
`node:sqlite`, Docker ativo e a imagem `postgres:16-alpine` disponível:

```powershell
npm test
npm run test:sync
npm run build
```

`test:sync` cria seu próprio container temporário, publica uma porta aleatória
somente em loopback e usa credenciais exclusivas de teste. Não utiliza o banco
indicado pelo ambiente. Aplica a adição SQL sobre tabelas de baseline descartáveis,
usa conexões independentes e encerra/remove seu container ao terminar normalmente.
Se o processo for encerrado à força, confira apenas containers com o prefixo
`agrohacka-sync-test-`; não remova o container de desenvolvimento.

A suíte comprova retry, conflitos, rollback, isolamento, excesso combinado e um
fluxo HTTP NestJS + `openapi-fetch` + dois SQLite reais, com resposta perdida e
dispositivo revogado. Não comprova WebView, Android/iOS, LAN ou ambiente de produção.

## Limitações deliberadas

- Sem cursor incremental, paginação congelada ou tombstones. Downloads completos
  aumentam de custo com o histórico; não implantar em escala sem medir e limitar.
- Sem referência física compartilhada nem detecção automática de duplicidade
  humana: dois IDs iguais em produto/dia/quantidade continuam sendo dois fatos.
  A equipe deve conferir a operação com o gestor antes de qualquer ajuste.
- Revisões locais são preservadas e exibidas, mas não há fluxo autorizado de
  resolução/estorno, contagem física, reservas/cotas ou encaminhamento LAN.
- Quantidades continuam `Float` no schema existente. A soma central usa Decimal,
  mas isso não torna o armazenamento original exato; precisão fixa é evolução
  contratual separada, não garantia desta versão.
- O lock coordena `/sync`, `POST /products` e edição/exclusão de operadores;
  não existe log de mudanças comum a todos os escritores.
  Outros endpoints e a segurança global da API precisam de revisão própria.
- Credenciais de pareamento continuam reutilizáveis pelo fluxo existente; expiração,
  uso único e rate limiting são trabalho adicional. Tokens locais não têm cofre.
- O saldo local é validado pela fila do cliente, não como reserva global nem como
  garantia contra processos/janelas independentes escrevendo simultaneamente.

## Cadastro de insumos do gestor

`POST /products` exige JWT de gestor e deriva a fazenda da identidade autenticada.
O cliente envia `CreateProductDto` com UUID estável, nome, categoria, unidade e
estoque mínimo. Preço, validade (`YYYY-MM-DD`), lote e fornecedor são opcionais;
preço ausente é desconhecido, enquanto zero informado é válido.

Mesmo UUID/conteúdo normalizado devolve o produto original; conteúdo diferente
ou colisão com outra fazenda recebe 409 genérico, sem expor o cadastro alheio.
A criação usa a mesma trava transacional de fazenda do sync e não insere saldo
nem movimentação de abertura. Não exige migration: o schema existente já contém
esses campos. Não há edição ou exclusão por essa rota.

O produto aparece em `newProducts` no download completo já existente, inclusive
para operadores. O cadastro exige internet; as entradas/saídas continuam offline.
Publicar a nova API antes do cliente que usa a rota. O contrato foi gerado pelo
`npm run openapi` a partir do Swagger compilado; não foi escrito à mão.

`npm run test:sync` também executa `test/products.postgres.integration.ts`: dois
clientes PostgreSQL independentes, mesmo ID, conflito de conteúdo/fazenda,
rollback e recebimento pelo sync, sempre em container descartável sem volumes.

## Administração dos operadores

`PATCH /devices/{id}` altera somente `nomeOperador` e/ou `ativo`;
`DELETE /devices/{id}` exclui somente o dispositivo da fazenda autenticada.
Ambas exigem JWT de gestor, recusam operador e credenciais misturadas e usam o
lock de fazenda do sync. DELETE é idempotente: repetir a exclusão ou indicar um
ID inexistente na própria fazenda não altera outros registros nem revela dados
de outra fazenda. PATCH de ID ausente/alheio retorna 404.

Movimentações continuam guardando apenas o nome histórico (`responsavel`), sem
adicionar FK ao operador. Recibos (`actorId`) e logs mantêm suas referências
históricas em texto. Não há migration nem alteração no schema para esta entrega.
Renomear/excluir não modifica os movimentos ou seus recibos.

O sync revalida o operador ativo sob o lock, além da autenticação inicial. Se uma
exclusão/desativação confirmar enquanto um pedido aguarda a trava, esse pedido
recebe 401 antes de gravar efeitos. Um pedido que concluiu antes da exclusão
permanece no histórico. Ações offline posteriores não podem ser impedidas
remotamente; o cliente mantém sua fila ao receber 401. Sincronizar pendências
antes da exclusão; não criar outra autoria ou reaplicar a fila automaticamente.

Publicar a API atualizada junto ao novo cliente. O contrato foi regenerado pelo
comando oficial a partir do Swagger compilado, sem edição manual. Os testes
descartáveis de produtos também cobrem administração e corrida de exclusão/sync.
