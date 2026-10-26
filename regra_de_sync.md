# Regras de sincronização — SQLite local e PostgreSQL na nuvem

Status: arquitetura de referência e implementação incremental. A seção 14 distingue
o que já foi implementado nesta branch das propostas futuras. Foi aprovada a política
de preservar fatos com déficit consolidado e sinalizá-lo ao gestor; as alternativas
de cotas/reservas e permissões de correção não estão automaticamente aprovadas.

## 1. Decisão principal

Sincronizar **movimentações identificáveis e imutáveis**, não substituir o saldo de
um aparelho pelo saldo de outro. Cada dispositivo possui seu próprio SQLite. A
API recebe os registros, valida sua origem, consolida o histórico no PostgreSQL e
distribui as mudanças confirmadas aos demais dispositivos.

O transporte pode repetir uma mensagem; o efeito no estoque não pode se repetir.
Assim, buscamos entrega **pelo menos uma vez**, com aplicação idempotente, e não a
promessa de que a rede entregará cada mensagem exatamente uma vez.

Não é um diff de arquivos `.db`, nem uma migration de dados entre aparelhos.
Migrations evoluem a estrutura das tabelas. A sincronização trabalha com registros
e regras do domínio, mesmo quando os dois bancos usam estruturas diferentes.

### O que aproveitar do Anki

O Anki mantém cópias locais, reúne mudanças entre dispositivos e realiza
sincronizações automáticas. Seu manual também explica que determinados conflitos
exigem escolher uma cópia, substituindo mudanças da outra. Podemos aproveitar a
experiência offline e os backups, mas **não copiar essa substituição integral para
o estoque de vários operadores**. Uma retirada real não deve desaparecer porque
outro aparelho foi escolhido como vencedor. Essa é uma adaptação nossa, não uma
descrição do protocolo interno do Anki. [Manual oficial do Anki](https://docs.ankiweb.net/manual/syncing).

## 2. O que significa “a mesma alteração no mesmo dia”?

O dia, o produto e a quantidade não identificam uma operação de forma suficiente.
É perfeitamente válido abastecer dois tratores com 20 L de diesel no mesmo dia.

| Situação                                     | Exemplo                                                    | Tratamento proposto                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Reenvio técnico                              | A API gravou a saída, mas a resposta se perdeu.            | Reenviar o mesmo `movementId`; confirmar sem aplicar novamente.                                            |
| Duas operações reais                         | Ana abasteceu o trator A e Bruno abasteceu o trator B.     | Manter as duas saídas, mesmo com produto, quantidade e dia iguais.                                         |
| Dois registros da mesma operação física      | Ana e Bruno registraram o mesmo abastecimento do trator A. | Usar uma referência operacional compartilhada; sem ela, sinalizar suspeita para revisão.                   |
| Duas retiradas que excedem o saldo conhecido | Ambos viram 100 L; um retirou 70 L e outro 50 L offline.   | Preservar os fatos e apontar divergência, ou exigir reservas prévias se a regra for impedir essa situação. |
| Duas contagens absolutas                     | Um operador contou 80 L e outro contou 75 L.               | Tratar como observações de inventário, não como duas entradas/saídas somáveis.                             |

**UUID resolve reenvio, mas não resolve sozinho duplicidade humana:** dois
operadores podem gerar UUIDs diferentes para a mesma operação física.

## 3. Integridade possível e limite do modo offline

Devemos separar três garantias:

1. Integridade técnica: transações, referências válidas, isolamento por fazenda e
   ausência de aplicação duplicada do mesmo registro.
2. Integridade operacional: o lançamento corresponde a uma operação física real e
   foi registrado uma única vez. Depende também do processo de trabalho.
3. Disponibilidade global: saber quanto ainda pode ser retirado considerando todos
   os aparelhos, inclusive os desconectados.

Conseguimos implementar a primeira garantia. Melhoramos a segunda com identidade
operacional, autoria, revisão e conferência física. Não podemos garantir a terceira
em tempo real com vários aparelhos totalmente desconectados e autorização
ilimitada para retirar o mesmo estoque.

Um lock no PostgreSQL organiza requisições que chegaram à nuvem. Ele não informa
ao celular offline o que os outros operadores estão fazendo.

### Política recomendada para o desafio: registrar fatos e reconciliar

Como a interface registra **movimentações já realizadas**, a recomendação é:

- Aceitar na nuvem movimentações válidas, independentes e autorizadas, mesmo se a
  consolidação revelar saldo negativo.
- Gerar uma divergência crítica, mostrar o saldo apurado e solicitar revisão ao
  gestor. Não transformar o saldo em zero, apagar uma saída ou inventar entrada.
- Permitir que o gestor resolva a causa: duplicidade, entrada não registrada,
  unidade incorreta, perda ou erro de contagem.
- Corrigir por novos registros auditáveis, sem alterar o histórico silenciosamente.

Exemplo: saldo consolidado de 100 L, saída A de 70 L e saída B de 50 L. Se ambas
ocorreram, o saldo contábil fica em **−20 L com divergência**, não em 30 L por
descartar B. Isso evidencia que o histórico conhecido não explica a realidade.

Esse modelo garante registro e rastreabilidade; **não promete saldo não negativo**.
O bloqueio atual do cliente contra saída acima do saldo local pode continuar como
proteção inicial, mas não impede excesso combinado entre aparelhos. Um fluxo de
exceção local, com justificativa, é uma evolução a discutir, não está implementado.

### Se a exigência for nunca autorizar retirada acima do disponível

Nesse caso, mudar a regra operacional:

- Online: solicitar autorização/reserva à autoridade central antes da retirada.
- Offline: distribuir previamente cotas exclusivas por aparelho ou operador.

Exemplo: dos 100 L, Ana recebe direito de retirada de 60 L e Bruno de 40 L. Cada um
só autoriza até sua cota restante. Novas entradas não viram cota global disponível
automaticamente enquanto não forem validadas.

As cotas precisam ser debitadas atomicamente, não podem ser copiadas ao clonar ou
restaurar um banco e não podem ser redistribuídas só porque o outro aparelho ficou
offline. Revogação e devolução precisam de um protocolo seguro. Essa alternativa
tem custo maior e reduz a liberdade offline; fica fora do MVP recomendado.

Não confundir “autorização para uma retirada futura” com “registro de uma retirada
que já aconteceu”. Uma autorização recusada pode não gerar saída; um fato ocorrido
não deve ser apagado para manter uma projeção aparentemente consistente.

## 4. Modelo de dados conceitual

Os nomes abaixo representam o protocolo futuro, não os DTOs disponíveis hoje.

### Movimentação

- `movementId`: UUID criado uma vez, antes do primeiro salvamento local.
- `farmId`: fazenda; sempre confrontada com a identidade autenticada na API.
- `productId`: produto, com unidade e lote identificados; incluir depósito quando
  houver mais de um local de estoque.
- `tipo`: entrada ou saída; `quantidade` sempre positiva.
- `quantidadeBase` e `unidadeBase`: representação canônica, por exemplo 20 L como
  20.000 mL. Usar inteiros seguros ou decimais exatos, com precisão e limites
  acordados, sem somar litros a quilos.
- `occurredAt`: horário informado da operação, usado para histórico e análise.
- `originDeviceId` e `actorId`: origem e responsável verificáveis; nome é apenas
  informação de exibição, não autenticação.
- `operationId`, `operationLineId` e `effect`: referência operacional compartilhada,
  quando disponível.
- `reversalOf`: referência à movimentação estornada, quando aplicável.
- `payloadHash`: resumo de uma representação canônica dos campos imutáveis.
- `receivedAt` e `serverVersion`: atribuídos pelo servidor, nunca pelo relógio do
  operador para resolver concorrência.

Quantidade zero, negativa, não finita, unidade incompatível, produto ausente ou de
outra fazenda e identidade inválida devem ter resultados explícitos de validação.
Decimais/inteiros grandes devem trafegar como strings quando excederem a precisão
segura do JavaScript. A transformação de unidades e o hash precisam ter versão de
protocolo, para que normalizações diferentes não sejam confundidas com adulteração.

### Estruturas de apoio

| Estrutura                         | Responsabilidade                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Histórico de movimentações        | Fonte auditável das entradas, saídas e estornos.                                 |
| `sync_outbox` local               | Registros ainda sem resultado definitivo da nuvem.                               |
| Recibos de processamento na nuvem | Resultado durável por identificação e hash, incluindo recusas de negócio.        |
| Referências operacionais únicas   | Relacionar uma operação física ao seu lançamento canônico.                       |
| Projeção de saldo                 | Cache derivado do histórico; nunca é o valor arbitrado por um aparelho.          |
| Registro de mudanças da fazenda   | Mudanças ordenadas para download incremental, inclusive revisões e desativações. |
| Estado de sincronização           | Cursor aplicado, versão do protocolo e época do histórico.                       |
| Pendências de revisão             | Duplicidades suspeitas, conflitos e divergências com resolução auditada.         |

O saldo de abertura deve ser uma entrada identificada, não um número inicial
escondido que cada aparelho poderia aplicar novamente.

## 5. Duas camadas de deduplicação

### 5.1 Identidade técnica: `movementId`

No servidor, uma restrição única em `(farmId, movementId)` e uma transação garantem:

- Mesmo ID e mesmo conteúdo canônico: devolver o resultado já registrado.
- Mesmo ID com conteúdo diferente: devolver `ID_PAYLOAD_CONFLICT`, sem sobrescrever
  a movimentação anterior.
- ID ainda não processado: validar e gravar uma única vez.

Não usar `upsert` com atualização livre de quantidade para implementar
idempotência. Isso transforma um reenvio em edição de histórico. A detecção de
conflito deve ocorrer antes de produzir qualquer novo efeito no estoque.

No cliente, o UUID pertence ao rascunho da operação. Clique duplo ou retry do
salvamento deve reutilizar a mesma identidade. Desabilitar o botão é uma proteção
de interface adicional, não a garantia principal.

### 5.2 Identidade operacional: mesma operação física

Quando houver ordem, recibo, nota, requisição ou abastecimento compartilhado, usar
uma chave única de negócio, por exemplo:

```text
(farmId, operationId, operationLineId, effect)
```

Essa chave deve ser compartilhada **antes** do registro, por exemplo em um QR Code
da requisição. Cada aparelho inventar seu próprio `operationId` não resolve.

Com a mesma chave e o mesmo efeito semântico — produto, lote/depósito, quantidade
e unidade canônica — o segundo registro retorna `DUPLICATE_OF`, apontando o ID
canônico. Sua tentativa fica auditada, mas não gera uma segunda saída.

Com a mesma chave e conteúdo incompatível, devolver `BUSINESS_REFERENCE_CONFLICT`
para revisão, sem criar outro efeito no estoque. Metadados de autoria e envio
podem diferir sem que isso signifique outra operação física.

A chave precisa refletir a granularidade real: entregas parciais exigem parcelas
distintas; uma transferência tem efeitos distintos de saída e entrada. Não impor
unicidade apenas por nota, produto ou dia.

Sem referência compartilhada, não existe deduplicação automática confiável.
Semelhança de produto, quantidade, horário, destino e operador serve para abrir
uma **suspeita**, não para apagar ou unir lançamentos automaticamente. As duas
saídas permanecem no histórico e no saldo apurado, com indicação de possível
duplicidade, até decisão do gestor. Esconder uma delas poderia esconder consumo real.

Regra operacional simples para o MVP: cada operação tem um responsável pelo
lançamento; os demais podem conferi-la. Quando possível, esse responsável usa uma
requisição numerada/QR compartilhada. A sincronização complementa esse processo,
não substitui a identidade da operação.

## 6. Escrita local offline

Para salvar uma movimentação:

1. Identificar a sessão, produto, unidade e rascunho com UUID estável.
2. Validar os campos e a política de saldo conhecida pelo aparelho.
3. Em **uma transação SQLite**, gravar a movimentação, sua entrada na outbox e a
   projeção local, caso ela seja persistida. Se houver bloqueio por saldo ou cota,
   reler e validar esse limite dentro da mesma transação antes de debitar, para
   impedir disputa entre janelas/processos locais.
4. Confirmar sucesso na interface somente depois do commit local.
5. Recalcular alertas locais e solicitar sincronização quando possível.

Se faltar energia no meio, ou todos os registros da transação persistem, ou nenhum.
As operações precisam usar a mesma conexão transacional, como já faz o comando
Rust/SQLx do cliente. Exclusão mútua no processo ajuda no mesmo aparelho, mas não
coordena celulares diferentes; preservar também restrições e transações no banco.

O saldo exibido deve distinguir:

- **Saldo confirmado conhecido:** calculado com os registros da nuvem já aplicados
  localmente, acompanhado da revisão/data da última atualização.
- **Saldo provisório:** saldo conhecido mais movimentações locais ainda pendentes.
- **Divergências:** registros recusados, duplicidades suspeitas ou inconsistência
  consolidada, sem esconder o registro original.

“Confirmado conhecido” não significa atualizado com todos os aparelhos offline.
Se a nuvem ainda não conhece uma retirada, ela também não conhece seu efeito.

## 7. Protocolo de envio e confirmação

### Fluxo proposto

```text
registro local + outbox (transação SQLite)
                 ↓
envio de lote com IDs e conteúdo estáveis
                 ↓
validação + recibos + histórico + mudanças (transação PostgreSQL)
                 ↓
resultados por ID + download de mudanças
                 ↓
aplicação + atualização da outbox/cursor (transação SQLite)
```

O endpoint pode continuar sendo `POST /sync`, mas os campos novos devem entrar em
uma evolução versionada e documentada do contrato. **A resposta atual não oferece
os resultados abaixo.**

Cada lote contém versão do protocolo, identidade do dispositivo, cursor de download
e uma lista limitada de operações. Começar com lotes de até 100 operações é uma
hipótese de implementação a medir, não um requisito do banco.

### Resultados por operação

| Resultado da nuvem                                    | Significado                                                 | Ação local                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ACCEPTED`                                            | Registro persistido, com seu efeito e versão.               | Incorporar a forma canônica e encerrar o envio desse ID.                      |
| `ALREADY_APPLIED`                                     | Mesmo ID/conteúdo já foi processado.                        | Recuperar o resultado anterior, sem aplicar novamente.                        |
| `DUPLICATE_OF`                                        | A referência física já tem lançamento canônico equivalente. | Relacionar a tentativa ao canônico e remover seu efeito provisório duplicado. |
| `ID_PAYLOAD_CONFLICT` / `BUSINESS_REFERENCE_CONFLICT` | Identidade reutilizada com conteúdo incompatível.           | Preservar e encaminhar para revisão; não repetir indefinidamente.             |
| `VALIDATION_REJECTED`                                 | Operação não atende às regras.                              | Guardar motivo e tentativa, sem incluí-la no saldo confirmado.                |
| Falha transitória ou resultado ausente                | Não se sabe se houve commit.                                | Manter pendente e reenviar exatamente o mesmo ID/conteúdo.                    |

Resultados definitivos de negócio devem ser duráveis. Uma nova tentativa do mesmo
comando deve receber a mesma decisão. Corrigir um comando recusado requer uma nova
operação identificada, vinculada à tentativa anterior, não mutação do payload antigo.

Um HTTP 200 ou a quantidade total de itens recebidos não é confirmação individual.
A resposta deve identificar todos os IDs do lote, seu resultado e, quando cabível,
`canonicalMovementId`, conteúdo canônico e versão. O cliente valida respostas
incompletas, repetidas ou fora da fazenda antes de encerrar qualquer pendência.

As confirmações valem somente depois do commit na nuvem. Se a conexão cair depois
do commit e antes da resposta, o reenvio consulta o recibo e não debita novamente.

### Aplicação no cliente sem dupla contagem

Manter uma única identidade lógica por movimentação. A confirmação transforma o
registro provisório em confirmado; não cria uma segunda movimentação somável.
Quando o mesmo registro chegar no download, incorporá-lo por ID sem somar de novo.

Para `DUPLICATE_OF`, preservar a tentativa em auditoria, mas substituir sua
contribuição provisória pelo lançamento canônico único. A resposta precisa permitir
incorporar esse lançamento mesmo que ele já esteja antes do cursor do aparelho.

Aplicar página recebida, resultados correspondentes, projeções afetadas e cursor
em uma transação local. Uma falha deixa a transação inteira para reaplicação. Um
registro criado enquanto a requisição estava em andamento não pertence ao lote
anterior e continua na outbox.

## 8. Concorrência no PostgreSQL e cursor sem perda

### Estratégia inicial: escrita serializada por fazenda

Para o volume esperado do desafio, usar uma linha `farm_sync_state` por fazenda,
criada junto com ela. Todo caminho que altera dados sincronizáveis deve:

1. Autenticar e validar o formato da requisição.
2. Iniciar uma transação curta em isolamento `READ COMMITTED`.
3. Bloquear primeiro essa linha da fazenda com `SELECT ... FOR UPDATE`.
4. Consultar recibos e referências operacionais novamente sob esse bloqueio.
5. Validar dependências, gravar operações novas, atualizar projeções e gerar
   divergências conforme a política aprovada.
6. Incrementar um contador **transacional da própria linha** e publicar mudanças
   com versões crescentes na mesma transação. Alterações rejeitadas não produzem
   efeito de estoque; seus recibos e pendências de revisão são persistidos.
7. Fazer commit e somente então responder com confirmações definitivas.

Isso serializa commits da mesma fazenda, não de fazendas diferentes. Locks de linha
são mantidos até o fim da transação e impedem escritores concorrentes sobre a linha
bloqueada. [Documentação do PostgreSQL sobre locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

Não fazer chamadas HTTP, WhatsApp ou aguardar o usuário dentro da transação.
Notificações externas devem sair de uma outbox transacional do servidor após o
commit, com sua própria deduplicação. Retries de transação usam os mesmos IDs; se
outros locks forem necessários, adquiri-los em uma ordem consistente.

Na política alternativa de autorização estrita, a reserva e a verificação do saldo
ocorrem sob esse mesmo lock/transação. Na política de registro de fatos, serializar
não impede saldo negativo: organiza sua apuração e a geração de divergência.

### Por que não usar apenas timestamp, UUID ordenável ou `BIGSERIAL`?

O cursor precisa representar um **prefixo confirmado do histórico**. Relógios dos
celulares podem estar incorretos e `updatedAt` não é um marcador seguro de commits.
Mesmo sequências do PostgreSQL têm alocação independente do rollback: não devemos
confundir número alocado com mudança já confirmada. [Documentação sobre sequências](https://www.postgresql.org/docs/current/functions-sequence.html).

Exemplo de falha com sequência sem serialização: A recebe versão 41 e demora para
comitar; B recebe 42 e comita primeiro; o cliente baixa 42 e avança; A comita 41,
que não aparece na busca `version > 42`. O lock por fazenda, adquirido **antes** da
atribuição das versões e mantido até o commit, evita essa ultrapassagem.

Um simples `SUM` seguido de `INSERT` em requisições paralelas também não cria uma
garantia de saldo. A leitura, decisão e gravação devem compartilhar o mecanismo de
concorrência escolhido. [Isolamento de transações no PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html).

### Download incremental

- Cursor por fazenda e instalação, contendo época do histórico e última versão
  aplicada; transmitir versões grandes como strings ou tokens opacos.
- Após o push, capturar um limite superior confirmado `H` e a primeira página sob
  um snapshot de leitura consistente. O isolamento `REPEATABLE READ` é uma opção
  para essa leitura; não manter a transação aberta entre requisições HTTP.
- Buscar mudanças com `cursor < version <= H`, ordenadas por versão, em páginas.
  O limite `H` fica fixo para aquela rodada, enquanto o log histórico é preservado.
- Retornar `nextCursor` da última mudança entregue e `hasMore`. Ao esgotar as
  mudanças daquela rodada, o cursor pode chegar a `H`.
- Aplicar cada página e avançar seu cursor na mesma transação SQLite.
- Receber confirmação do próprio push **não autoriza pular o cursor de download**:
  podem existir mudanças de outros operadores entre a revisão anterior e a nova.
- Repetir páginas é permitido; pular versões confirmadas não é.

Todos os escritores de produtos, movimentações, revisões e desativações precisam
usar esse caminho transacional. Um endpoint paralelo escrevendo sem publicar no log
quebra a garantia. Não usar apenas um mutex em memória do NestJS: múltiplos processos
da API não compartilham esse mutex.

Cada entrada do log deve carregar o conteúdo daquela revisão, ou permitir recuperar
esse conteúdo histórico. Buscar um ID antigo no log e devolver o cadastro vivo mais
recente pode misturar revisões além de `H`. No cliente, uma página antiga também não
pode sobrescrever um cadastro que já tenha uma versão confirmada mais nova.

Para aumentar escala depois, medir contenção e avaliar processamento particionado
ou captura de mudanças por ordem de commit. Não remover o lock global da fazenda
mantendo a mesma suposição de cursor. É uma mudança de protocolo, não só otimização.

## 9. Edições, estornos e inventário físico

Movimentação confirmada não é editada nem apagada pelo operador. Se uma saída de
20 L deveria ser 15 L:

1. Criar um estorno de entrada de 20 L ligado à saída original.
2. Criar a saída correta de 15 L.
3. Publicar as duas correções como um grupo atômico, com motivo e autoria do gestor.

O efeito líquido será uma devolução de 5 L. Reenvio não pode produzir dois estornos;
o servidor valida a referência, a permissão e a unicidade da reversão integral.
Na interface, o original aparece como estornado, mas seus efeitos e os do estorno
devem se compensar: não excluir o original do cálculo e ainda somar sua compensação.

Contagem física é outra operação: “encontrei 75 L” não significa “retirei 25 L”.
Guardar observação, produto/lote/local, horário, autor e revisão conhecida. Se dois
operadores contarem, o gestor decide qual observação representa o corte de estoque
e como considerar movimentações posteriores. Só então emite um ajuste explícito,
calculado sobre uma revisão conhecida e validado transacionalmente.

Produtos e outros cadastros mutáveis usam `expectedVersion` para controle otimista.
Se a versão mudou, abrir conflito; não escolher pelo relógio do celular. Desativação
de cadastro deve produzir tombstone/versionamento e preservar referências do
histórico; não fazer exclusão física em cascata de movimentações auditáveis.

## 10. Segurança e isolamento

- A API valida JWT do gestor ou credencial de dispositivo ativo e vinculado à
  fazenda. `deviceId`, `farmId` e nome enviados no JSON não são prova de identidade.
- Validar também que o produto pertence à fazenda autenticada, mesmo se o UUID
  existir. Uma foreign key isolada não substitui essa autorização.
- Recibos, buscas, cursores e referências de negócio devem ser isolados por fazenda.
- Operador não pode estornar, ajustar inventário ou editar outro lançamento sem
  permissão. A autoria de registros encaminhados via gestor/LAN deve manter uma
  proveniência verificável, não confiar em um `originDeviceId` arbitrário do body.
- Token expirado/revogado bloqueia o envio, não destrói o SQLite. Preservar outbox
  e apresentar a ação necessária para regularização pelo gestor.
- Um aparelho offline pode registrar antes de saber que foi revogado; esses
  registros serão preservados localmente e avaliados ao reconectar. Não prometer
  revogação instantânea em dispositivos desconectados.

## 11. Quando sincronizar e como lidar com falhas

Tentar ao abrir/retomar o app, recuperar conexão, após novos registros e por botão
manual. Um intervalo de segurança com backoff exponencial e jitter evita vários
aparelhos repetindo requisições simultaneamente. Não depender só do fechamento:
sistemas mobile podem encerrar o app sem dar tempo de sincronizar.

Manter no máximo uma rodada ativa por instalação/fazenda e preservar pendências
duráveis ao reiniciar. Retry de rede e de transação nunca gera um novo `movementId`.
Erros de autenticação exigem ação específica; conflitos definitivos vão para revisão,
não para uma repetição infinita da mesma requisição.

Por simplicidade, um lote normal pode ser confirmado em uma transação, com resultado
por item. Grupos dependentes, como estorno + substituição, são indivisíveis. Uma
falha de infraestrutura aborta tudo que ainda não teve commit; validações de negócio
previstas produzem recibos explícitos sem descartar silenciosamente outros itens.

## 12. Sincronização LAN: uma evolução separada

O gestor pode futuramente receber registros dos operadores e encaminhá-los à nuvem.
As identidades originais, conteúdo e referências operacionais devem ser preservados:
encaminhar não cria outra movimentação.

Separar os estados **salvo no aparelho**, **recebido de forma durável pelo gestor**
e **confirmado na nuvem**. Um recibo LAN não equivale a `ACCEPTED` do PostgreSQL.
O operador deve conservar uma cópia recuperável até a confirmação da nuvem, mesmo
se o gestor já tiver sua própria fila de encaminhamento.

Se o gestor recebeu o lote e a resposta LAN se perdeu, o operador pode enviar à
nuvem sem gerar duplicidade: o mesmo ID será usado nas duas rotas. Autenticação e
idempotência precisam funcionar independentemente da rota escolhida.

LAN reduz a janela de divergência entre aparelhos conectados à fazenda, mas não
elimina concorrência com outros aparelhos isolados ou conectados direto à nuvem.
Não transformá-la em uma segunda autoridade de reserva sem delegação explícita.

## 13. Backups, restauração e sincronização inicial

Backup é recuperação de desastre; não é transporte de sincronização.

- Restaurar um SQLite antigo não desfaz fatos já confirmados no PostgreSQL.
- Reenviar registros restaurados com seus IDs originais é seguro por idempotência.
- Um cursor antigo pode baixar páginas novamente; a aplicação deve ser idempotente.
- A restauração não pode regenerar UUIDs de registros existentes.
- Registros ainda não enviados e criados depois do backup não podem ser recuperados
  pela nuvem. Preservar o snapshot de recuperação e oferecer conciliação/exportação.
- Compactar o log de download não pode apagar a proteção contra reenvio: preservar
  identidades e recibos de deduplicação pelo tempo em que registros antigos puderem
  reaparecer, inclusive por restauração. Retenção menor exige uma política explícita
  que coloque envios antigos em revisão, sem reaplicá-los automaticamente.
- Clonar um banco não pode clonar direitos de retirada nem a identidade de uma nova
  instalação. Novos registros do clone exigem nova identidade de dispositivo; manter
  a origem histórica dos registros restaurados.

Um aparelho novo baixa um snapshot consistente da fazenda e recebe seu cursor `H`.
Para o MVP, esse snapshot pode ser uma resposta completa sob uma leitura consistente,
desde que seu tamanho seja limitado. Nunca substituir a base de um aparelho que
tem pendências sem preservar e reincorporar sua outbox.

Se o histórico incremental for compactado ou o cursor pertencer a outra época,
retornar `RESET_REQUIRED` e fornecer novo snapshot sem perder pendências locais.
Snapshots grandes paginados precisam de uma visão congelada/materializada em `H`
ou reconstrução histórica equivalente. Paginar tabelas vivas e etiquetar tudo com
um cursor antigo não produz um snapshot consistente.

## 14. Situação do código atual e lacunas

### 14.1 Implementação cloud nesta branch

Em `codex/offline-stock-sync`, criada da `dev`, o protocolo 2 implementa:

- Autenticação JWT do gestor ou token de operador ativo, com fazenda/produto/autoria
  verificados. Emissão de pareamento exige gestor; conexão manual devolve credencial.
- Lock da fazenda no PostgreSQL, movimentações imutáveis e recibos transacionais
  por ID/hash/autor. Retry recupera a decisão anterior; conteúdo diferente não edita
  o histórico. Recusas de validação são duráveis.
- Preservação de retiradas válidas mesmo com déficit combinado, incluindo o cenário
  100 − 70 − 50 = −20. Divergência é retornada e mostrada, não corrigida artificialmente.
- Download completo de produtos/movimentos sob snapshot consistente, **sem cursor**.
  Não há ainda `farm_sync_state`, contador de commits ou log incremental da seção 8.
- Rascunho local com ID persistido; outbox, confirmação individual, revisão e última
  rodada gravadas atomicamente no SQLite. A tela distingue saldo conhecido e provisório.
- Testes com conexões PostgreSQL independentes e fluxo HTTP NestJS + `openapi-fetch`
  + dois SQLite reais, incluindo rollback, resposta perdida e revogação de operador.

O contrato do cliente é gerado pelo comando existente `npm run openapi`, a partir
da API atualizada. A adição `api/prisma/sync-migrations/002_sync_receipts.sql` ainda
precisa ser aplicada explicitamente ao banco de destino após backup; os testes só
usaram bancos descartáveis. Não houve mudança em envs nem na migration SQLite 001.

Continuam propostas, não implementações: referência física e suspeita automática
de duplicidade humana, cursor seguro/paginação, tombstones, precisão fixa no schema
(ainda `Float`), LAN, cotas/reservas, estorno, inventário físico, resolução auditada
e outbox de notificações. Revisão hoje é uma listagem preservada no aparelho, não
um fluxo de decisão concluído do gestor. Os testes não validam WebView/mobile real.

O detalhamento de compatibilidade e implantação está em `api/SYNC.md`. A versão 2
substitui a resposta legada de análise por recibos/divergências; publicar as duas
pontas coordenadamente. Não declarar compatibilidade irrestrita com clientes antigos.

### 14.2 Diagnóstico histórico anterior a esta implementação

A tabela e os pontos abaixo registram a baseline da `dev` inspecionada em
19/10/2026, **antes** das alterações da seção 14.1. Não descrevem o estado atual
desta branch nem constituem auditoria do serviço em produção.

| Área              | O que existe hoje                                                                                          | O que falta para esta proposta                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Cliente SQLite    | Movimento e outbox transacionais; UUID; fila de escritas; validações locais.                               | Identidade operacional, rascunho idempotente, estados de revisão e projeções confirmada/provisória explícitas. |
| Cliente HTTP      | `openapi-fetch`; reenvio dos mesmos IDs; download completo; confirmação por contagem do lote.              | Recibos individuais e cursor seguro, após evolução do contrato.                                                |
| Testes do cliente | SQLite real e servidor simulado para convergência e perda de resposta.                                     | Concorrência contra PostgreSQL real e casos da matriz abaixo.                                                  |
| API `/sync`       | `upsert` por ID, lista de movimentações/produtos e horário de resposta.                                    | Registro imutável, hash, resultado por item, transação coordenada, log e cursor por commit.                    |
| Autorização       | Cliente envia credenciais quando disponíveis. O controller de sync inspecionado não declara guard próprio. | Validar proteção efetiva no backend e vincular fazenda/produto/dispositivo à identidade autenticada.           |
| Modelo de estoque | Movimentos de entrada/saída; quantidade `Float` no Prisma; produto com lote opcional.                      | Precisão canônica, origem verificável, referências de operação, correções auditáveis e divergências.           |
| LAN               | Helper de fallback no cliente, ainda sem servidor gestor.                                                  | Recebimento durável, autenticação de origem e distinção dos recibos LAN/nuvem.                                 |

Pontos concretos de atenção:

1. `api/src/sync/sync.service.ts` permite atualizar quantidade, destino e responsável
   de um ID existente. Isso não oferece a imutabilidade proposta.
2. O mesmo serviço usa `Promise.all` de upserts, sem uma transação única envolvendo
   histórico, recibos, log e projeções. Uma falha pode ocorrer após gravações parciais.
3. O `serverTimestamp` é gerado depois das consultas. Usá-lo como próximo cursor
   pode pular uma gravação que ficou entre a consulta e a geração desse horário.
   O cliente atual evita essa janela não enviando `lastSyncTimestamp` e baixando
   o conjunto completo. Isso custa mais tráfego, mas não deve ser removido antes
   de existir um cursor consistente.
4. `client/src/offline/local-store.ts` gera UUID dentro de cada `recordMovement`.
   Repetir uma chamada de criação não é o mesmo que reenviar um ID da outbox:
   o rascunho estável ainda precisa ser implementado.
5. A confirmação por `syncedCount` não comprova os IDs e decisões por operação.

Referências locais: `client/src/offline/sync.ts`,
`client/src/offline/local-store.ts`, `client/src/api/client.ts`,
`api/src/sync/sync.service.ts`, `api/src/sync/sync.controller.ts` e
`api/prisma/schema.prisma`.

## 15. Plano de implementação por responsabilidade

### DEV 1 — contrato e autoridade central

1. Definir autenticação de sync para gestor e operador e isolamento por fazenda.
2. Evoluir o modelo com recibos, origem, referência operacional, precisão e log.
3. Implementar transação serializada por fazenda e resultado idempotente por item.
4. Definir publicação de mudanças em todos os caminhos de escrita e cursor seguro.
5. Implementar divergências, resoluções e outbox de notificações após commit.
6. Publicar o contrato OpenAPI atualizado; preservar compatibilidade ou versionar.

### DEV 2 — cliente offline

1. Persistir o UUID do rascunho e impedir criação duplicada por clique/retry local.
2. Adicionar novas migrations locais, sem editar a migration 1 já aplicada.
3. Exibir estado provisório, revisão conhecida, pendências e motivos de conflito.
4. Adaptar `openapi-fetch` ao contrato publicado e processar recibos por ID.
5. Aplicar páginas/cursor e transições da outbox de forma atômica e idempotente.
6. Validar restauração, retomada, duas instalações e, posteriormente, o relay LAN.

### Em conjunto — escolhas de negócio

- Aprovar registro de fatos com divergência ou autorização estrita com reservas.
- Definir o documento/QR que identifica uma operação física e seu responsável.
- Definir unidade mínima, precisão, lotes, depósitos e corte do inventário físico.
- Definir quem pode revisar, estornar e ajustar; registrar motivos obrigatórios.
- Alinhar fórmulas de saldo e alertas entre cliente e backend.

Ordem sugerida: segurança e idempotência → consolidação concorrente → recibos por
ID → download incremental → revisão operacional → LAN. Não é necessário introduzir
Kafka, replicação binária de bancos ou um CRDT genérico para o MVP. Somar eventos
independentes ajuda na convergência, mas não resolve identidade física ou cotas.

## 16. Matriz mínima de testes antes de implementar

Aplicar TDD: escrever os testes abaixo antes de cada funcionalidade, comprovar RED,
implementar o mínimo, comprovar GREEN e refatorar. Esta matriz é um plano: não
significa que todos esses testes já existem ou foram executados.

| Caso                                                                       | Resultado esperado                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Uma entrada e uma saída válidas                                            | Saldo igual à soma algébrica dos eventos únicos.                               |
| Lista vazia; saldo zero; sem histórico                                     | Sync válido sem inventar movimentos ou gerar quantidade inválida.              |
| Quantidade nula, ausente, zero, negativa, infinita ou unidade incompatível | Resultado de validação explícito, sem efeito confirmado.                       |
| Frações e conversões válidas; limites de precisão excedidos                | Soma exata na unidade base ou rejeição explícita.                              |
| Dois aparelhos, duas saídas reais iguais no mesmo dia                      | Duas movimentações preservadas.                                                |
| Dois aparelhos, mesma operação física com chave compartilhada              | Um efeito, duas tentativas auditáveis.                                         |
| Mesma chave física com quantidades diferentes                              | Conflito para revisão, sem sobrescrever o canônico.                            |
| Mesmo UUID com conteúdo diferente                                          | Conflito de payload, sem alterar o registro anterior.                          |
| Mesmo UUID recebido simultaneamente por duas instâncias da API             | Uma gravação; resultado consistente para ambas.                                |
| Produto, fazenda, origem ou credencial não autorizados                     | Nenhuma leitura/gravação indevida ou confirmação falsa.                        |
| Lote com produto inexistente ou dependência ausente                        | Resultado explícito; grupo dependente não é aplicado parcialmente.             |
| Falha local entre gravar movimento e outbox                                | Rollback completo; nunca sucesso visual sem persistência.                      |
| Commit na nuvem e resposta perdida; envio por LAN e nuvem                  | Retry não duplica movimento nem efeito.                                        |
| Falha depois de parte de um lote e antes do commit                         | Nenhuma confirmação indevida; replay seguro.                                   |
| Resposta com ID ausente, repetido, desconhecido ou de outra fazenda        | Não encerrar indevidamente pendências locais.                                  |
| Operação nova durante a sincronização                                      | Nova pendência fica para a próxima rodada.                                     |
| Download do próprio movimento já confirmado pelo push                      | Não contar duas vezes nem avançar além de outras mudanças.                     |
| Reinício entre aplicar página e salvar cursor                              | Ambos persistem juntos ou a página é reaplicada sem duplicar.                  |
| Relógios incorretos, fusos e passagem de dia                               | Nenhuma perda por ordenação temporal ou deduplicação por data.                 |
| Transação A atrasada e B concorrente                                       | Cursor nunca ultrapassa uma mudança ainda não publicada.                       |
| Alteração durante paginação; snapshot inicial; cursor expirado             | Retomada sem pular registros e sem apagar outbox.                              |
| Saídas de 70 L e 50 L sobre 100 L, política de fatos                       | Dois fatos, saldo −20 L, divergência crítica e revisão.                        |
| Mesmo cenário, política estrita de cotas/reservas                          | No máximo o direito disponível é autorizado, sem duplicação por retry/restore. |
| Estorno repetido e estorno + substituição interrompidos                    | Um estorno por original; correção agrupada é atômica.                          |
| Duas contagens físicas diferentes                                          | Observações preservadas; ajuste somente após resolução com revisão válida.     |
| Cadastro alterado/desativado enquanto o aparelho ficou offline             | Conflito/tombstone explícito, histórico preservado.                            |
| Restauração de backup e clone de dispositivo                               | IDs históricos preservados; nenhuma duplicação de direito de retirada.         |
| Notificação com envio repetido após falha                                  | Reprocessamento controlado sem criar novo efeito de estoque.                   |

Os casos de concorrência e locks devem rodar contra PostgreSQL real com conexões
independentes. Testes apenas com mock ou SQLite não comprovam o isolamento do
servidor. No cliente, usar SQLite real para transações e falhas de retomada, além
de validar o fluxo em Android e desktop.

## 17. Resumo para decidir em equipe

Para o MVP, a combinação recomendada é **histórico de movimentações imutáveis +
UUID estável + outbox transacional + recibo por ID + referência operacional quando
disponível + revisão explícita de divergências**. O download incremental só entra
quando existir um cursor que não perca commits.

O ponto decisivo não é “dois operadores podem mexer no mesmo produto no mesmo
dia?”. Podem. Precisamos saber se foram **duas operações reais**, **o reenvio do
mesmo lançamento** ou **dois lançamentos da mesma operação física**. A regra de
identidade resolve cada caso sem descartar consumo legítimo. E, se a equipe exigir
impedir excesso global ainda offline, terá de aceitar cotas prévias ou alguma
autoridade acessível antes da retirada.
