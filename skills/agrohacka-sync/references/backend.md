# Backend — NestJS, PostgreSQL e contrato

Use esta rota junto com o `SKILL.md`. Na proposta `regra_de_sync.md` da raiz da
aplicação, leia também as seções 8–13 para concorrência, correções, segurança,
retomada e snapshots. A parte de LAN da proposta é histórica: a API não tem mais
rotas de IP local nem heartbeat (tarefa 5.7).

## Inspeção orientada à tarefa

Localize o controller/service de sync, guards e autorização global, modelo Prisma,
migrations, motor de estoque e testes existentes. Confira como outros endpoints
escrevem produtos/movimentações: um cursor só é seguro se todos os escritores
publicarem mudanças pelo mesmo mecanismo.

Antes de evoluir o contrato, identifique os clientes que ainda usam o protocolo
anterior. Não renomeie `id` para `movementId` nem publique campos/estados novos sem
uma decisão explícita de compatibilidade ou versão. Os nomes da proposta são
conceituais, não autorização para reescrever todos os DTOs.

## Recepção e idempotência

- Autentique gestor ou dispositivo ativo antes de tratar o lote. Vincule fazenda,
  produto, autoria e permissões à identidade verificada; não aceite a fazenda do
  body como autoridade nem revele recibos de outra fazenda.
- Defina a canonicalização versionada do payload e a chave única por fazenda/ID.
  Restrição única é a garantia final; consulta seguida de insert isolado não basta.
- Para mesmo ID e conteúdo, recupere o recibo original. Para conteúdo diferente,
  produza conflito sem sobrescrever o evento ou o recibo original.
- Quando houver chave física compartilhada, valide sua granularidade. Mesmo efeito
  semântico aponta para o canônico; conteúdo incompatível abre conflito. Sem chave,
  semelhança de horário/quantidade não autoriza deduplicação destrutiva.
- Grave efeito, recibo, projeção e publicação de mudança em uma transação coordenada.
  Responda somente após commit. Uma falha de infraestrutura permite retry com os
  mesmos IDs; uma recusa de negócio deve ter resultado explícito e durável.
- Defina grupos atômicos para correções dependentes. Validação parcial do lote não
  pode separar estorno e substituição nem confundir rollback com confirmação.

Não usar `upsert` que atualiza quantidade de um evento existente como idempotência.
Um `ON CONFLICT` usado apenas para arbitrar identidade ainda precisa comparar
conteúdo e recuperar o resultado correto, sem repetir o débito.

## Concorrência, saldo e publicação

Para a estratégia inicial da proposta, todas as escritas sincronizáveis de uma
fazenda adquirem primeiro o lock da linha de estado da fazenda em transação curta.
Consulte identidades/recibos sob esse lock, aplique mudanças e incremente seu contador
transacional antes do commit. Um mutex em memória não coordena instâncias da API.

Na política aprovada de registro de fatos, consolide todos os eventos válidos e
sinalize déficit; lock não significa proibição automática de saldo negativo. Na
política estrita, reserva/verificação e débito do direito pertencem à mesma transação.
Não implementar cotas sem tratar clonagem, recuperação e revogação dos direitos.

Se uma tarefa precisar trocar esse desenho por locks por produto ou CDC, demonstre
novamente a garantia do cursor. Um `BIGSERIAL`/UUID temporal sozinho não ordena
commits; uma otimização não pode introduzir a perda de versão atrasada.

Recibos por ID devem informar o resultado e o canônico quando aplicável. Não tratar
`syncedCount` como prova de confirmação individual. Notificações externas saem após
commit por outbox, sem chamada de rede segurando transação/lock e sem novo efeito
de estoque quando a notificação for repetida.

## Download e recuperação

Publique entradas de log com conteúdo da revisão. Use cursor por fazenda/época e
limite superior confirmado fixo por rodada. Não buscar conteúdo vivo mais novo para
preencher uma entrada antiga. Preserve tombstones e referências históricas.

Snapshot inicial precisa de visão consistente com seu cursor; paginação de tabelas
vivas não congela essa visão. Cursor expirado exige reset seguro com preservação da
outbox do cliente. Compactação do log não deve apagar a proteção de idempotência
enquanto backups/dispositivos antigos puderem reenviar eventos.

## Testes a selecionar antes da implementação

- Duas conexões e duas instâncias enviando o mesmo ID; mesmo ID com payload alterado.
- Dois IDs legítimos iguais em produto/dia; mesma referência física com IDs distintos.
- Falha antes do commit, resposta perdida após commit e reenvio com decisão idêntica.
- Isolamento entre fazendas, origem forjada, token revogado e produto fora do escopo.
- Escrita A atrasada e B concorrente; paginação com novas escritas e limite superior.
- Reversão repetida, correção agrupada, tombstone e snapshot com cursor consistente.
- Casos de saldo conforme a política aprovada, precisão, listas vazias, zero,
  campos ausentes/nulos e entradas inválidas da matriz da proposta.

Use infraestrutura descartável e autorizada, não a VPS/base real. Se PostgreSQL de
teste não estiver disponível, informe exatamente o que não foi comprovado; não
declare a concorrência validada somente porque mocks passaram.
