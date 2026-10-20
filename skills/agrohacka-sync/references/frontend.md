# Frontend — Vue, Tauri, SQLite e openapi-fetch

Use esta rota junto com o `SKILL.md`. Na proposta `regra_de_sync.md` da raiz da
aplicação, leia também as seções 8–13 antes de alterar cursores, correções,
autenticação, retomada, LAN ou restauração.

## Inspeção e dependência do contrato

Localize persistência local, coordenador de sync, cliente HTTP, controlador de
workspace, componentes e testes envolvidos. Confira o contrato OpenAPI gerado e
as respostas reais previstas; não suponha que a API já implementa a proposta.

Mantenha `openapi-fetch` tipado pelo contrato publicado. Não invente confirmação
individual, cursor ou token de dispositivo que o backend não retornou. Se a tarefa
depender de evolução da API não autorizada, documente a dependência e implemente
somente o trabalho local independente; não ative o novo protocolo contra o antigo.

Enquanto não houver cursor seguro, preserve a estratégia existente de download
completo e a proteção das pendências locais. Uma contagem de lote pode ser uma
limitação do contrato atual, mas não deve ser apresentada como recibo por operação.

## Gravação local e autoria

- Persista a identidade do rascunho antes da primeira tentativa. Cliques repetidos,
  retomada e retry local devem reencontrar esse ID, não gerar novos eventos.
- Grave movimento, outbox e eventual projeção na mesma transação SQLite/SQLx e
  conexão. Se a regra bloquear saldo/cota local, valide o limite na transação que
  realiza o débito; leitura anterior não impede disputa entre janelas/processos.
- Derive o responsável da sessão verificada. Nome exibido ou campo readonly não
  substitui autenticação na nuvem. Capture a referência física compartilhada quando
  o fluxo aprovado a fornecer; não fabrique uma chave independente por aparelho.
- Mostre sucesso de salvamento somente após commit local. Recalcule os alertas com
  os registros locais e sinalize a natureza provisória das novas movimentações.
- Evolua o schema em nova migration. Preserve os bytes/checksum da migration aplicada
  e as regras de LF; nunca exigir reset do SQLite do usuário para atualizar o app.

## Envio, recebimento e estados

Use uma rodada ativa por instalação/fazenda e capture os IDs do lote antes do envio.
Um lançamento criado durante a requisição fica para a rodada seguinte. Preserve
ID/conteúdo em timeout, reinício, retry e troca de rota LAN/nuvem.

Quando o contrato oferecer recibos individuais:

- Valide IDs, escopo, duplicação e completude dos resultados antes de encerrar
  pendências. Operação sem resultado conclusivo continua recuperável.
- `ACCEPTED` e replay confirmado incorporam a forma canônica e encerram o envio.
  Confirmar o provisório e depois recebê-lo no download não pode somar duas vezes.
- `DUPLICATE_OF` preserva a tentativa em auditoria e substitui seu efeito provisório
  pelo canônico único. Incorpore o canônico mesmo se estiver antes do cursor atual.
- Conflitos/recusas definitivos guardam motivo e vão para revisão, sem retry infinito
  nem remoção silenciosa do registro. Falha transitória mantém retry com backoff.
- Dados, recibos, projeções e avanço do cursor persistem atomicamente. ACK do push
  não é autorização para avançar o cursor de download e pular eventos de terceiros.
- Páginas repetidas devem ser idempotentes; versões antigas não sobrescrevem versões
  mais novas. Snapshot/reset preserva e reincorpora pendências locais.

Não declarar sucesso global porque a rede respondeu, o aparelho está online ou
o gestor recebeu por LAN. Separe “salvo neste aparelho”, “recebido pelo gestor” e
“confirmado na nuvem”, com revisão conhecida e pendências visíveis.

## Conflitos e experiência do operador/gestor

Mostre separadamente saldo confirmado conhecido, efeito pendente e divergências.
Retiradas iguais no mesmo dia podem ser reais: sem referência física compartilhada,
abra suspeita para revisão, não descarte uma delas automaticamente.

Se a política aprovada admitir registro de fatos com déficit, mostre a divergência
e o fluxo de resolução. Não zere o saldo nem prometa disponibilidade global offline.
Se exigir cotas, exponha somente o direito realmente concedido e validado; não
derive a cota de uma cópia do saldo total.

Contagem física é observação de inventário, não substituição direta do histórico.
Estornos/ajustes exigem permissão e motivo; correções agrupadas não podem aparecer
como definitivamente concluídas quando só parte foi confirmada.

## Restauração, sessão e retomada

Preserve outbox em falha de autenticação e peça regularização. Não deslogar/apagar
dados para resolver rejeição da API. Reinicie retries ao retomar/recuperar conexão,
sem depender da execução no fechamento ou de tarefas mobile em segundo plano.

Restauração conserva IDs e não desfaz a nuvem. Não clonar identidade ativa/cotas para
um novo aparelho. Antes de qualquer recuperação destrutiva, preserve pendências e
snapshot; a skill não autoriza apagar o banco do usuário ou buscar seus tokens.

## Testes a selecionar antes da implementação

- Clique duplo/retry de criação e reabertura do mesmo rascunho com um único ID.
- Falha entre movimento e outbox com rollback real; reinício após salvar offline.
- Resposta perdida depois do commit remoto e reenvio sem novo débito.
- Dois SQLite locais com operações legítimas iguais e referências físicas duplicadas.
- Download do próprio evento confirmado; recibo incompleto/forjado; nova saída no
  meio de uma rodada e páginas repetidas após falha.
- Saldo conhecido/provisório, divergência e estado LAN/nuvem coerentes na interface.
- Expiração da sessão, cursor antigo, restauração de backup e troca de dispositivo.
- Quantidades zero/nulas/ausentes/inválidas, lista vazia, unidades e precisão da matriz.

Use SQLite real em bancos temporários para demonstrar atomicidade e recuperação,
e servidor simulado para falhas de transporte. Isso não comprova locks PostgreSQL
nem execução em WebView/Android/iOS: reporte essas validações separadamente.
