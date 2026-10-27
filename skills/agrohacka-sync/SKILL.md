---
name: agrohacka-sync
description: "Implementar ou revisar sincronização de estoque do AgroHacka entre SQLite/Tauri e PostgreSQL/NestJS: outbox, idempotência, concorrência entre operadores, recibos, cursores, estornos e recuperação. Use para alterações nesses fluxos no backend ou frontend; não para estilização ou tarefas genéricas sem efeito na sincronização."
---

# AgroHacka Sync

## Escopo e fonte de verdade

Localize a raiz do AgroHacka a partir do workspace atual, onde ficam `AGENTS.md`,
`tarefas.md` e `regra_de_sync.md`. A skill pode estar instalada fora do repositório:
não use sua própria pasta como raiz da aplicação. Se a proposta estiver ausente,
peça o documento antes de decidir um protocolo; não aplique estas regras a outro
produto por semelhança de tecnologia.

Leia as instruções de projeto e a tarefa pertinente. Em `regra_de_sync.md`, leia as
seções 1–7 e 14–17 como base compartilhada; leia as demais seções quando a rota abaixo
as exigir. A proposta é a referência de arquitetura, mas o contrato e o código
inspecionados determinam o que está implementado hoje. Revalide essa distinção em
cada tarefa, sem perpetuar o diagnóstico de uma versão antiga.

Criar esta skill não aprova automaticamente todas as decisões da proposta. Antes
de mudar comportamento dependente de saldo negativo, cotas, deduplicação física ou
permissões de revisão, verifique a decisão aprovada pela equipe. Se faltar, apresente
a escolha e avance apenas no trabalho que não dependa dela.

## Escolha da rota

- Backend/NestJS, Prisma, PostgreSQL, autenticação ou contrato: leia
  [references/backend.md](references/backend.md).
- Frontend/Vue, Tauri, SQLite, cliente HTTP, estados de sync ou recuperação: leia
  [references/frontend.md](references/frontend.md).
- Alteração contratual autorizada de ponta a ponta: leia ambas. Defina a evolução
  do contrato antes de adaptar o cliente e teste sua compatibilidade.

Não editar outra camada só porque a skill cobre as duas. A divisão DEV 1/DEV 2 não
substitui a autorização do pedido. Respeite a restrição vigente de não alterar a API
em uma tarefa exclusivamente desktop sem permissão. Não introduza envs nem altere
credenciais/configuração externa como efeito colateral.

## Invariantes compartilhadas

0. **Somente nuvem.** Desde a tarefa 5.7 a sincronização é exclusivamente pela API
   central: não há LAN, heartbeat, IP local nem comunicação entre aparelhos. As
   seções de LAN de `regra_de_sync.md` são históricas; não reintroduza esse
   transporte sem nova decisão da equipe.

1. **Registro não é saldo.** Sincronize movimentações e derive o saldo. Não use o
   saldo absoluto de um aparelho nem last-write-wins para substituir o histórico.
2. **Identidade técnica é estável.** Um rascunho recebe um ID uma vez; clique duplo,
   retry e restauração preservam esse ID. Mesmo ID/conteúdo repete o
   resultado; mesmo ID/conteúdo diferente gera conflito, não edição silenciosa.
3. **Identidade física é outra garantia.** Duas saídas iguais no mesmo dia podem
   ser legítimas. Deduplicação física exige referência compartilhada da operação,
   linha e efeito. Sem isso, sinalize suspeita e mantenha revisão humana.
4. **Rede repete; efeito não.** Grave movimento/outbox localmente e efeito/recibo
   na nuvem com transações. Confirmação da nuvem só existe após commit. Preserve
   registros sem resultado definitivo e separe rejeição de negócio de falha transitória.
5. **Autoria e fazenda são verificadas.** Não confie em `farmId`, `deviceId` ou nome
   no JSON como autenticação. Valide também produto/lote/unidade e escopo de revisão.
6. **Offline não oferece disponibilidade global instantânea.** Não prometa impedir
   excesso combinado sem cotas exclusivas ou uma autoridade acessível. Não esconda
   divergências zerando saldo, descartando retirada ou inventando entrada.
7. **Cursor não é relógio.** Timestamps e números alocados antes do commit não
   bastam. Download deve representar prefixo confirmado e aplicar dados/cursor
   atomicamente; o ACK do próprio push não permite pular mudanças de terceiros.
8. **Correção é auditável.** Use estorno/ajuste autorizado, preserve o original e
   impeça compensação duplicada. Backup não é sync; restaurar não desfaz a nuvem.
9. **Quantidade tem unidade e precisão.** Não misture massa e volume nem introduza
   conversões/rounding divergentes entre as pontas. A representação exata é parte
   do contrato, não uma mudança unilateral de tipo no cliente.

## Execução e entrega

Para o comportamento solicitado, escolha os casos pertinentes da matriz de testes
da proposta e siga o TDD do projeto: comprove RED pelo motivo correto antes da
implementação, GREEN e regressões depois. Não use testes que só procuram palavras
em documentação como prova de integridade.

Use bancos temporários/de teste. Testes de concorrência do servidor precisam de
PostgreSQL real com conexões independentes; SQLite e mocks não provam seus locks.
Não apagar banco do usuário, editar `_sqlx_migrations`, reescrever migration aplicada
ou atualizar produção para fazer teste passar.

Na entrega, informe escopo alterado, comando e resultado dos testes, compatibilidade
do contrato, limitações e pendências da outra camada. Atualize somente os itens de
`tarefas.md` realmente implementados e validados. Não marcar LAN, recibos individuais,
cursor seguro ou política de negócio como prontos apenas por existirem nesta skill.
