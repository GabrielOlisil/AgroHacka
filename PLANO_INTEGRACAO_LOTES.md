# Integração de lotes e carregamentos — plano de migração

Data: 30/10/2026. Status: **planejado, não implementado**.

Objetivo: permitir que entradas e saídas identifiquem o lote/carregamento, mantendo o catálogo, o histórico, o saldo por produto, as sessões e as pendências SQLite existentes. A troca do seed é independente da migração dos bancos instalados.

Este plano orienta uma evolução posterior à versão da final. Não muda a tag avaliada, não executa o seed, não autoriza alterações em produção e não reaplica a migration SQLite 001. Decisões de ativação e implantação são conferidas antes de executar as fases abaixo.

## 1. Ponto de partida confirmado no código

- `Product` possui `lote`, `validade`, `fornecedor` e `precoAquisicao`; `StockMovement` não identifica o estoque físico de origem.
- `POST /sync` aceita somente protocolo 2. `content()` no serviço seleciona os campos antigos e o hash usa a versão 2. Acrescentar um campo no JSON hoje não o torna sincronizável.
- `SyncReceipt` conserva hash, autor e resultado por fazenda/ID. Alterar a canonicalização de um movimento antigo pode transformar um retry legítimo em conflito.
- SQLite guarda produtos, movimentos e outbox em JSON. `parseProduct` e `parseMovement` selecionam campos conhecidos: precisam evoluir para não descartar os dados novos.
- O Tauri registra somente `001_offline.sql`. A restauração em `storage.rs` copia uma lista fixa de tabelas e exige evolução junto com o schema.
- A API inicia pelo Dockerfile com `prisma db push`. Há também SQL de sync aplicado por procedimento próprio. Não existe hoje uma cadeia completa de migrations de aplicação que possa ser presumida como pronta.
- `loadDemoFarm` não apaga dados e retorna `JA_EXISTE` se o gestor da demonstração já estiver cadastrado. Mudar o dataset não atualiza essa fazenda.

Esses são pontos de implementação atuais. As estruturas das próximas seções são propostas.

## 2. Modelo recomendado para a primeira entrega

```text
Produto 1 ── N Lotes/carregamentos
Produto 1 ── N Movimentações (histórico existente)
Movimentação 1 ── 0..1 Detalhe de estoque ── 1 Lote/carregamento
```

### Produto

Mantém ID, fazenda, nome, categoria, unidade, mínimo e estado ativo/excluído. Seus IDs não mudam. Campos antigos continuam durante a transição, identificados como legados.

### Lote/carregamento (`StockBatch`, nome conceitual)

- `id`: UUID estável criado antes da primeira gravação/envio.
- `farmId`, `productId`: escopo obrigatório; lote não pode pertencer a outro produto ou fazenda.
- `referencia`: identificação legível, por exemplo “Compra cooperativa novembro”.
- `referenciaNormalizada`: chave de comparação, única por fazenda/produto. Não usar uma unicidade global entre produtos.
- `codigoFabricante`: opcional; não precisa ser único, pois um lote industrial pode chegar em entregas diferentes.
- `validade`: data de calendário opcional (`YYYY-MM-DD`), sem alterar o dia conforme o fuso.
- `origem`: normal ou legado; `identificacaoConferida` distingue informação física confirmada de hipótese histórica.
- Revisão e estado arquivado para edição concorrente e preservação histórica.

Lotes vencidos não são apagados nem confundidos com esgotados. Não excluir um lote referenciado por movimentação. Arquivar não apaga seu efeito no estoque nem esconde saldo remanescente dos alertas.

Validade organiza a lista, mas não identifica o lote. Duas cargas com a mesma validade continuam distintas. A referência sugerida pode conter validade e um sufixo do UUID; fica estável se a validade mudar. Sem validade, sugerir “Recebimento <data> · <sufixo>”. O usuário pode informar uma referência própria.

O UUID é a identidade usada pelos movimentos. A unicidade da referência legível é validada no servidor sob o lock da fazenda. Duas criações offline com referência igual não são fundidas: geram conflito explícito de referência, preservando os registros para resolução. Nunca mudar o lote de uma saída para resolver esse conflito. Na UI, o identificador curto distingue provisórios de mesmo nome.

### Detalhe de estoque da movimentação (`MovementStockDetail`)

Tabela adicional ligada à movimentação, com fazenda, produto e lote, sem reescrever o conteúdo do evento original. Para entradas novas, pode guardar preço unitário pago e fornecedor daquele recebimento, ambos opcionais; para saídas, identifica a origem retirada.

Restrições mínimas:

- Um detalhe por `(farmId, movementId)`.
- Produto/fazenda do detalhe iguais aos do movimento e do lote, garantidos no banco quando possível e validados no serviço.
- Detalhe obrigatório em movimentações novas do protocolo 3; ausências antigas só são aceitas no caminho legado.
- Quantidade vem do movimento; o detalhe não cria outro efeito de entrada ou saída.

A tabela adicional permite associar movimentos antigos a um agrupamento legado sem alterar IDs, quantidade, data, autoria, recibos ou hash original.

**Escopo inicial: um carregamento por movimentação.** Na saída há um select obrigatório. Para consumir dois carregamentos, salvar duas saídas explicitamente identificadas; cada uma é um fato independente, com seu UUID. Um formulário com múltiplas linhas e atomicidade de grupo fica para evolução posterior.

Preço pago passa a poder ser registrado na entrada, mas esta migração não escolhe implicitamente custo médio ou FIFO financeiro. Durante a transição, a valorização e a ABC existentes mantêm o preço do produto como **preço de referência estimado**, claramente rotulado. A migração para custo real por recebimento exige política e testes próprios; não é requisito para ativar a seleção por lote.

## 3. Invariantes e limites de compatibilidade

1. A soma das entradas menos saídas por produto não muda durante a migração.
2. O efeito de um movimento aparece uma vez: atribuir lote não é registrar outra entrada.
3. A soma dos saldos dos lotes, incluindo o agrupamento legado, corresponde ao saldo do produto. Saldo negativo existente continua negativo e sinalizado.
4. IDs, payloads e datas de pendências anteriores não são regenerados. Recibos e hashes v2 não são recalculados.
5. Retry, timeout após commit e restauração preservam identidade e efeito; mudar lote de um evento v3 já confirmado deve gerar conflito, não uma edição silenciosa.
6. Nome de responsável continua sendo o histórico atual; não adicionar FK de operador como parte desta tarefa.
7. Não inferir procedência real pela data da compra, pelo nome do fornecedor ou pelo saldo restante.
8. Quantidade conserva unidade e representação atuais. Não incluir uma conversão geral de Float para outra precisão nesta migração; a auditoria usa a mesma política numérica nas duas pontas, com tolerância documentada onde necessária, sem arredondar os eventos originais.

**Continuidade por produto não significa rastreabilidade retroativa por lote.** Clientes antigos continuam podendo enviar fatos, mas não conseguem escolher lote. Seus registros ficam no agrupamento legado e tornam a distribuição física pendente de conferência. Não apresentar os saldos dos lotes identificados como plenamente conciliados enquanto houver essa pendência.

## 4. Migração dos bancos existentes, sem seed

### 4.1 Inventário antes da alteração

- Identificar versões de API/clientes, schema efetivo do PostgreSQL e procedimento de deploy.
- Capturar backup e validar recuperação em ambiente isolado.
- Gerar relatório por fazenda/produto: contagem e IDs de movimentos, saldo, quantidade de recibos, metadados legados e divergências já existentes.
- No teste com SQLite instalado, incluir sessão, rascunho, outbox pendente e revisões; não coletar tokens em relatórios.
- Não exigir que todos os celulares estejam online ou com fila vazia para preservar seus dados.

### 4.2 Expansão do schema

Adicionar tabelas, índices, estado de migração por fazenda e metadados de versão necessários. Não remover `Product.lote`, `validade`, `fornecedor` ou `precoAquisicao` nesta fase.

Antes de publicar o novo schema, preparar uma migration aditiva versionada compatível com o banco atual. Como o deploy usa `db push` e há adições SQL fora do Prisma Migrate, conferir e estabelecer a baseline real sem reset; não executar `migrate deploy` presumindo que o histórico já existe. Revisar o SQL e a ordem de deploy em cópia descartável.

Separar a entrega de schema da ativação dos recursos. Nenhum processo antigo pode continuar escrevendo sem criar o detalhe correspondente depois do corte de migração.

### 4.3 Associação do histórico

Para cada produto, sob o mesmo lock de fazenda usado pelo sync:

1. Criar/encontrar um lote “Legado — identificação a conferir”, com identidade determinística e versionada por fazenda/produto. Cliente e servidor devem chegar à mesma identidade quando necessário.
2. Preservar lote/validade/fornecedor antigos como metadados históricos não conferidos. A validade física do lote legado permanece desconhecida até conferência; não disparar um alerta novo como se todos os recebimentos tivessem comprovadamente aquela validade.
3. Criar um detalhe para cada movimento histórico que ainda não tenha detalhe, apontando ao legado. Não inserir novos movimentos de abertura e não alterar os existentes.
4. Relatar produtos sem movimentos, com saldo zero e com déficit. Produto sem movimentos não recebe saldo fabricado.
5. Registrar conclusão e evidências do lote de migração na mesma coordenação transacional. Reexecutar não cria lotes ou detalhes duplicados.

Os novos caminhos de escrita v2 também criam o detalhe legado na transação de recebimento. Só ativar o controle de lotes de uma fazenda depois de concluir e auditar a associação histórica dela. Para fazendas grandes, processar por etapas idempotentes, medir o tempo de lock e evitar uma transação global longa.

Se o mesmo movimento surgir primeiro no download e depois em uma outbox antiga, a associação existente é reutilizada. O reenvio não cria outro lote nem outro detalhe.

### 4.4 Conferência posterior do estoque físico

Converter estoque legado em lotes físicos não é um backfill automático. Após contagem/conferência do gestor, será necessário um procedimento de identificação auditável que conserve o saldo total e registre origem, destino, quantidade, motivo e autoria. Não implementar essa redistribuição como uma compra e uma retirada fictícias, nem alterar recibos de movimentos antigos.

A primeira entrega pode manter o legado explícito, sem essa redistribuição. Se o corte operacional exigir dividir o saldo antigo entre lotes identificados, esse procedimento vira pré-requisito da ativação naquela fazenda e precisa de testes próprios. Não presumir que o MVP já tem ajustes/estornos implementados.

## 5. Contrato e sincronização durante a transição

### Protocolo 2 preservado

- Manter o endpoint e a canonicalização atuais para os comandos antigos.
- Novas operações v2 aceitas recebem detalhe no legado, com origem “cliente sem identificação de lote”.
- Retry devolve o recibo original, inclusive se não possuir dados novos. O snapshot v3 fornece os detalhes separadamente; não enriquecer o JSON de um recibo antigo para mudar seu significado.
- Conservar semântica de autenticação, isolamento e recusa por produto excluído; validar lote/produto no caminho novo.

### Protocolo 3 proposto

Adicionar um contrato versionado no `/sync`, aceitando 2 e 3. A versão não pode mudar só no cliente: o servidor atual recusa qualquer versão diferente de 2.

- Envelope v3 informa capacidades e entrega produtos, movimentos, lotes e detalhes.
- Cada comando informa sua versão de conteúdo. Isso permite enviar pendências v2 preservadas e fatos novos v3 na mesma instalação. Definir o DTO exato e exemplos antes de implementar o cliente.
- Comando v3 inclui lote e, numa entrada que cria um carregamento, os dados de criação com UUID estável. Hash v3 inclui os dados imutáveis novos. Ausente/null, datas, normalização de referência e preço zero precisam de regras explícitas.
- Movimento, criação de lote quando necessária, detalhe e recibo são gravados na mesma transação. Se qualquer dependência falhar, não confirmar parcialmente a entrada.
- O servidor reconhece os recibos existentes pela mesma identidade global `(farmId, movementId)`; versões diferentes não autorizam aplicar o mesmo ID novamente.
- A versão do hash/comando é conhecida; recibos antigos são interpretados como v2 sem regravar seus hashes. Mesmo ID v2 reenviado como v3 com outro conteúdo é conflito, não atualização.
- Nome/validade de um lote existente são metadados versionados. Editá-los não muda o ID nem recanonicaliza movimentos; correções exigem autorização e revisão esperada, com trilha de auditoria.
- Download continua sendo snapshot completo consistente, como hoje. Não introduzir cursor incremental nesta tarefa. Ler lotes, detalhes, produtos e movimentos sob a mesma visão.
- Aplicar o snapshot SQLite e os recibos atomicamente, respeitando dependências e conservando criações locais ainda pendentes. Dados remotos incompletos ou de outra fazenda não encerram a outbox.

### Matriz de versões

| Combinação | Comportamento exigido |
| --- | --- |
| API nova + app antigo | Sync v2 por produto funciona; fatos sem lote vão ao legado. A API não promete rastreabilidade individual para esse cliente. |
| API nova + app novo, com outbox antiga | Preserva conteúdo v2 por evento; recebe detalhes separados; novas operações usam v3 quando houver capacidade. |
| API antiga + app novo | Não criar lotes novos nem degradar uma operação v3 para v2. Guardar o que já foi salvo e orientar aguardar atualização da API; recursos antigos só funcionam pelo caminho explicitamente compatível. |
| Backup antigo + app novo | Atualizar schema e associar legado idempotentemente; IDs e outbox continuam originais. |
| Downgrade do binário após criar fatos v3 | Não suportado para escrita no mesmo banco. Binário antigo pode ignorar/dropar metadados; exigir atualização, sem apagar a base. |

O servidor mantém projeção v2 dos produtos para clientes antigos. Antes de ativar lotes reais numa fazenda, deixar de apresentar um lote/validade do produto como se descrevesse todo o estoque: esses campos devem ser nulos nessa projeção quando não forem uma informação válida para todo o produto. Isso reduz informação para versões antigas, em vez de fornecer uma validade falsa. A vigência por lote exige app atualizado.

Ativação registra capacidades e pendências por fazenda, mas não é garantia de identificar todos os aparelhos que nunca se conectaram. Uma entrada v2 recebida meses depois ainda deve ter um destino explícito e seguro. Não decidir a versão de um evento pelo relógio do celular.

## 6. SQLite e recuperação

1. Adicionar nova migration após a versão 1 e registrá-la em `lib.rs`. Não editar os bytes/checksum de `001_offline.sql` nem o nome/caminho do banco.
2. Adicionar tabelas locais de lotes/detalhes e dados de migração/capacidade, com índices por fazenda/produto. Se a associação depender de sessão/dados da aplicação, executá-la depois do DDL, idempotentemente, antes de habilitar o formulário novo.
3. Adaptar parsers, comparação de movimentos por versão, rascunho, persistência, `sameMovement`, recibos e merge do snapshot. JSON novo precisa sobreviver a salvar/reabrir/sincronizar.
4. A outbox antiga conserva o conteúdo do evento; a versão pode ficar em metadado adicional. Não adicionar `batchId` retroativamente ao payload assinado do comando v2.
5. Entrada offline cria lote local, movimento, detalhe e outbox na mesma transação. Uma saída offline referencia o UUID do lote já conhecido; ordem de envio precisa respeitar entrada criadora antes da saída, inclusive entre lotes de envio de 100 itens.
6. Se a criação do lote for recusada, saídas dependentes não recebem confirmação falsa nem ficam repetindo sem explicação. Preservar os fatos e encaminhar o grupo dependente à revisão; não encaminhar ao legado para esconder a recusa.
7. Adaptar `restore_database`: limpar/copiar novas tabelas na ordem correta; verificar o schema da origem e aceitar backup v1 por uma rota de adaptação explícita. Restaurar backup antigo em schema novo deve executar a associação de legado antes de liberar o app.
8. Preservar a cópia de recuperação, a sessão conforme a política atual, a integridade e o comportamento de retenção. Não alterar a migration 1 dentro de um backup.

Não é necessário apagar o SQLite para atualizar. Não é seguro apenas adicionar tabelas e deixar o código de restauração antigo intacto.

## 7. Interface e regras de negócio

- Cadastro do produto novo: nome, categoria, unidade e mínimo. Lote e validade são informados no recebimento. Manter leitura legada para consulta, não como edição de todos os lotes de uma vez.
- Entrada: selecionar carregamento existente ou “Novo lote/carregamento”; informar referência, validade opcional, quantidade, preço pago e fornecedor opcionais. Mesmo código de fabricante pode existir em recebimentos distintos; usuário escolhe a referência de estoque correspondente.
- Saída: select de lote, validade e saldo conhecido. Ordenar por vencimento crescente, sem validade por último; desempatar por recebimento e ID. Não confundir data mais próxima com identidade.
- Não selecionar automaticamente um lote vencido. Exibir indicação clara; a decisão de permitir registrar uma retirada já ocorrida de vencido deve ser confirmada antes da implementação, sem confundir registro com autorização de uso.
- Para um único lote elegível, sugeri-lo visivelmente. O operador confirma de onde retirou; nunca distribuir silenciosamente entre lotes.
- Lotes com saldo zero saem das opções normais, mas permanecem no histórico. Definir uma opção de exceção identificada para registro de fato já ocorrido, se necessária; não remover referências de eventos pendentes.
- Com quantidade maior que o saldo local do lote, avisar e pedir conferência. A regra atual de gravação precisa ser verificada nos dois formulários e no `LocalStore`: a política global aprovada preserva fatos com divergência, mas o cliente inspecionado contém bloqueio local e mensagem de UI que sugere aceitação. Resolver essa inconsistência em testes antes de ativar o novo formulário, sem alterar silenciosamente a política de negócio.
- Dois aparelhos podem consumir offline o mesmo lote além do saldo combinado. Preservar os fatos e mostrar divergência por lote e por produto; não mudar o lote confirmado para outro com saldo.
- Históricos mostram a referência e a validade do carregamento; sem identificação real, mostram legado. Os nomes de operadores continuam preservados como hoje.

## 8. Análise e alertas

- Falta, consumo diário, tendência, retiradas fora do padrão e mínimo continuam no agregado por produto.
- Vencimento passa a considerar cada lote com saldo positivo, data conhecida e identificação conferida. Lote esgotado não gera risco para unidades que já saíram.
- Para estimar sobra até as validades, distribuir a demanda projetada entre os lotes elegíveis em ordem de vencimento, sem aplicar o consumo total do produto independentemente a cada lote. É uma projeção de uso prioritário por validade, não uma redistribuição de saídas já registradas.
- Tratar vencidos, datas iguais, lotes sem validade, consumo zero, saldo negativo e estoque legado não identificado. Sem informação suficiente, indicar cobertura parcial de validade em vez de afirmar “sem risco”.
- A identidade do alerta de vencimento inclui o lote. O armazenamento de alertas da API hoje agrupa por produto/tipo: precisa mudar para distinguir dois lotes do mesmo produto, incluindo persistência, resolução, resumo, “o que mudou” e deduplicação de WhatsApp.
- Não renotificar em massa apenas porque a chave dos alertas mudou. Na ativação, reconciliar alertas abertos e preparar uma baseline de notificação auditada; notificar eventos novos/agravados conforme política, sem apagar o histórico anterior.
- API e app devem usar fixtures e data iguais no `parity.spec.ts`. Preço de referência continua estimado; não afirmar custo histórico ou capital exato por lote nesta fase.

## 9. Seed novo sem sobrescrever fazendas existentes

Criar versão explícita do dataset simulado (por exemplo `lotes-v1`), com `products`, `batches` e `movements`, e cada movimento referenciando produto e carregamento por uma referência estável do dataset.

O carregador deve:

- Validar referências, escopo, datas, preço zero/ausente e distribuição dos movimentos antes de escrever.
- Criar fazenda, catálogo, lotes, movimentos e detalhes numa transação, ou não criar nada.
- Preservar o comportamento não destrutivo: se a conta/dataset já existir, não sobrescrever nem inserir novamente as mesmas entradas.
- Gerar IDs estáveis dentro da carga e usar um registro de versão para retomada/idempotência. Não depender só de nomes ou de novas datas relativas em cada execução.
- Ancorar datas a uma data de referência definida por instância do dataset; reexecução não rejuvenesce a validade de um carregamento existente.
- Para demonstrar o modelo novo em banco com seed antigo, criar uma fazenda demonstrativa separada com namespace/conta de teste distintos, mediante autorização. Não trocar senha, e-mail, tokens ou propriedade da fazenda anterior como efeito colateral.
- Atualizar `prepareDemoLoad`, relatórios, validação, fixtures dos testes e exemplos do README depois que a implementação estiver pronta.

Cenários mínimos:

| Cenário | Resultado a demonstrar |
| --- | --- |
| Mesmo produto, duas cargas com validades diferentes | Seleção independente e alerta apenas sobre a quantidade em risco. |
| Mesma validade, referências diferentes | Não fundir os carregamentos. |
| Referência informal e código de fabricante | Identificação utilizável com ou sem código industrial. |
| Uma carga esgotada e outra disponível | Histórico preservado; saldo atual somente na carga remanescente. |
| Validade ausente | Mensagem de informação incompleta, não validade fabricada. |
| Recebimento sem preço e recebimento a preço zero | Ausente e zero permanecem diferentes. |
| Histórico antigo migrado | Mesmo saldo, mesmos IDs/recibos e identificação legada explícita. |

Os totais dos produtos podem ser mantidos na nova amostra, distribuindo as entradas e suas saídas. Os alertas de validade esperados podem mudar legitimamente; atualizar o gabarito com os cálculos por lote, sem ajustar o código só para preservar a contagem antiga de alertas.

**Seed não é migration:** nenhuma fase de implantação roda o novo seed para “corrigir” um banco real. A associação do histórico da seção 4 tem relatório e execução próprios.

## 10. Plano de execução e dependências

| Fase | Responsável | Entrega | Critério de saída |
| --- | --- | --- | --- |
| 0 | Ambos | Fechar DTO v3, regra de referência, legado, exceções e gate de ativação | Exemplos de versões antigas/novas e decisões registradas. |
| 1 | DEV 1 | Baseline/migration aditiva e associação idempotente do histórico | Banco antigo migra duas vezes com mesmos saldos, IDs e recibos. |
| 2 | DEV 1 | API v2/v3, escrita atômica e snapshot de lotes/detalhes | Cliente antigo funciona; entrada/saída v3 e replay funcionam em PostgreSQL real. |
| 3 | DEV 2 | Regenerar OpenAPI, migration SQLite, outbox/parser e recuperação | Instalação com pendências e backup antigo atualiza sem perda. |
| 4 | DEV 2 | Formulários e seleção por lote nos dois caminhos de movimentação | Seleção mantém lote no registro, reabertura e envio. |
| 5 | Ambos | Motor por lote, alertas persistidos e paridade | Validade por quantidade remanescente, identidade de alerta e notificação coerentes. |
| 6 | DEV 1 + DEV 2 | Seed versionado e ensaio isolado | Carga repetida não duplica; fluxo antigo e novo validados. |
| 7 | Ambos | Piloto e ativação por fazenda | Auditoria de saldos sem diferença; pendências/limitações comunicadas; aceite físico. |
| 8 | Ambos | Retirada futura do contrato/campos antigos | Nenhum consumidor depende deles; suporte a backups e retenção definidos. Não faz parte do primeiro rollout. |

Fase 3 começa depois da publicação do contrato; não editar `contract.d.ts` à mão. Usar `npm run openapi` com a API de teste atualizada. Telas podem ser preparadas com fixtures enquanto a API é desenvolvida, sem ativar contra produção.

Cada mudança funcional segue teste RED pelo motivo correto, implementação mínima GREEN e regressão. Testes de migration não usam somente correspondência de texto em SQL: executam contra PostgreSQL/SQLite reais e comparam o estado.

## 11. Matriz de testes de liberação

| Grupo | Casos obrigatórios |
| --- | --- |
| Migração PostgreSQL | Base vazia; produto sem movimento; saldo zero/negativo; todos os campos legados ausentes; associação parcial; reexecução; falha e retomada; todas as fazendas isoladas. |
| Conservação | Mesmos movimentos, IDs, quantidades, datas, autores e hashes/recibos antes/depois; saldo por produto igual à soma por lote; nenhum movimento de abertura artificial. |
| Migração SQLite | Banco 001 real no disco com sessão, rascunho, outbox e revisões; update e reabertura; checksum 001 inalterado; falha transacional e retomada. |
| Backup | Backup v1 restaurado no app novo; backup novo; integridade; recuperação; preservar identidades; não desfazer a nuvem. |
| Contrato | Envelope v2 inalterado; comandos v2/v3 na instalação nova; campos não descartados; API antiga não recebe evento v3 reduzido; resposta incompleta não encerra pendência. |
| Idempotência | Resposta perdida após commit; UUID repetido com mesmo conteúdo; mesmo UUID com lote/preço/dados de criação diferentes; replay do recibo v2 pós-migração; snapshots repetidos. |
| Dependências | Entrada offline cria lote; saída referencia esse lote; lote de envio de 100 termina entre as operações; falha/rejeição da criação preserva as dependentes. |
| Concorrência | Dois PostgreSQL independentes; duas criações com mesma referência; mesmo lote industrial em duas cargas; saídas concorrentes; migração disputando lock com sync. |
| Escopo | Lote de outro produto/fazenda; dispositivo inativo; produto excluído/desativado; lote arquivado; histórico não apagado por exclusão. |
| Interface | Ambos os formulários; select correto; saldo selecionado; referência informal; mesma validade; vencidos; esgotados; sem validade; produto só com legado; sessão trocada durante envio. |
| Análise | Falta agregada; validade por lote; consumo projetado sem dupla alocação; lote esgotado não alerta; dois lotes vencendo; alerta resolvido; pouca amostra; paridade API/app. |
| Bordas | Listas vazias/nulas, dados ausentes, quantidade zero/negativa/não finita, preço zero/nulo/inválido, unidade incompatível, dia inválido e fronteiras de fuso. |
| Seed | Referência inválida; duplicidade; erro no meio reverte; versão nova isolada; reexecução não altera validade nem saldo; fazenda existente intacta. |

Executar suites usuais (`api`: testes, build e `test:sync`; `client`: testes, check e build; Tauri: testes storage) e novas suites de migração. PostgreSQL é descartável, sem usar a URL do banco real. Android e Windows exigem aceite em instalação existente, incluindo uma fila criada na versão anterior.

## 12. Publicação e recuperação

Ordem de rollout:

1. Backup e ensaio da migration numa cópia isolada; registrar relatório inicial.
2. Schema aditivo, seguido da API de compatibilidade com novo modelo desativado. Coordenar o corte para não deixar instâncias antigas gravarem fora do caminho de associação.
3. Associar histórico por fazenda e reconciliar relatórios. Resultado reexecutável e verificado antes de avançar.
4. Distribuir cliente novo com migração/recuperação já prontas. Verificar que pendências antigas e novas podem coexistir.
5. Criar seed novo somente em ambiente demonstrativo autorizado e ensaiar ponta a ponta.
6. Ativar uma fazenda piloto; conferir divergências de lote/legado, sync antigo, alertas e atualização dos aparelhos. Só então ampliar.

Se falhar antes da criação de dados v3: manter o recurso desativado e a API compatível em funcionamento, conservando as tabelas novas. Não executar DROP para voltar à versão anterior.

Se já houver dados v3: parar a ativação e corrigir para frente mantendo uma API capaz de ler/escrever esse modelo. Não fazer downgrade do app/API que ignora os novos detalhes. Uma volta de binário só é permitida para uma versão comprovadamente compatível com o schema e os dados novos.

Backup é recuperação de desastre coordenada, não rollback automático do rollout: restaurar apenas o servidor apagaria fatos já confirmados nos aparelhos e poderia quebrar recibos. Preservar as filas e os bancos para diagnóstico; não pedir que o usuário desinstale ou limpe o SQLite.

## 13. Pronto significa

- [ ] Nenhuma diferença não explicada de saldo/identidade/recibo entre a base anterior e a migrada.
- [ ] Produto, lotes e movimentos continuam consistentes após migração repetida, retry, snapshot e restauração.
- [ ] Pendências v2 são preservadas; fatos v3 nunca perdem lote ao passar pela sincronização.
- [ ] Saída seleciona a origem física e a mantém até o histórico da nuvem.
- [ ] Referências repetidas e mesma validade não causam fusão indevida.
- [ ] Vencimento aponta quantidade do lote, com cobertura desconhecida explícita para legado.
- [ ] Novo seed demonstra o modelo sem modificar fazenda existente.
- [ ] Windows e Android foram atualizados sobre instalação anterior e aceitos.
- [ ] Operação de migração, compatibilidade e recuperação estão documentadas para o ambiente real.

Referências de arquitetura: `regra_de_sync.md`, `skills/agrohacka-sync/SKILL.md`, `api/SYNC.md`. Estratégia de expansão e retirada posterior: [guia Prisma sobre expand-and-contract](https://www.prisma.io/docs/guides/database/data-migration), apenas como padrão conceitual; os comandos de implantação devem corresponder ao Prisma instalado no projeto, sem atualização de major implícita.
