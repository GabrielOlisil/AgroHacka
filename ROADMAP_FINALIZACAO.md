# Roadmap de finalização — AgroHacka

Atualizado em 27/10/2026. Planejamento baseado na revisão do regulamento e da
`dev` em `32f958f`. Este documento descreve trabalho a executar; não comprova que
as correções foram implementadas. O checklist de execução fica em `tarefas.md`.

Referência: [regulamento oficial](https://incubadora.cloud/agrohack/assets/regulamento-agrohack.pdf),
especialmente seções 4, 6 e 7 e Anexos I–III. A apresentação é em 29/10; confirmar
nos canais da organização o prazo específico de submissão e a duração permitida.

## 1. Escopo decidido

**A sincronização será exclusivamente pela internet, com a API central em HTTPS.**
LAN não é mais um recurso adiado: está cancelada. Não implementar servidor no
gestor, relay, descoberta de IP, mDNS, heartbeat LAN, fallback local, estados de
recebimento pelo gestor, liberação de porta ou exceção HTTP para rede local.

O funcionamento offline permanece:

1. O usuário registra no SQLite e recebe confirmação do commit local.
2. Sem internet/API acessível, a movimentação continua na outbox do aparelho.
3. Ao recuperar conexão, o cliente envia os mesmos IDs à API central.
4. Somente recibos válidos da nuvem encerram as pendências, atomicamente.
5. Outros aparelhos recebem os dados quando também sincronizam pela internet.

Estar no mesmo Wi-Fi não permite sincronizar sem internet. O gestor não é um
servidor intermediário. Login e pareamento inicial exigem a API; sessões já
estabelecidas continuam permitindo trabalho offline. A disponibilidade efetiva
da API, e não apenas `navigator.onLine`, determina o sucesso da sincronização.

**Estado atual (27/10):** 5.7-A implementada no cliente, com transporte direto à
API e sem helpers LAN. Sessões e QR antigos ignoram os campos locais sem perder
credenciais. Endpoints/campos da API e do contrato ainda dependem de 5.7-B/C
(DEV 1). O restante do roadmap continua pendente conforme `tarefas.md`.

Também foi implementada a parte local de 10.4: amostragem junto à previsão,
financeiro parcial e itens sem preço fora da ABC. Regressão do cliente: 283
testes Vitest, checagem TypeScript, build da interface e 5 testes Rust aprovados;
teste Android físico não executado. Nenhum novo APK/instalador foi publicado.

## 2. Ordem de execução e paralelismo

| Ordem | Tarefa | Responsável | Dependência / conclusão |
| --- | --- | --- | --- |
| 1A | 5.7-A: retirar LAN do cliente | DEV 2 | Independente; sessões antigas continuam funcionando |
| 1B | 10.1: verificar e preparar os dados do desafio | DEV 1 | Confirmar fonte oficial; simulados identificados |
| 1C | 10.2: proteger a análise de estoque | DEV 1 | Isolamento por identidade autenticada |
| 2 | 10.3: corrigir unidades e unificar a análise utilizada | DEV 1 | Mesmos cenários e critérios do cliente |
| 3A | 10.4: incerteza e valores financeiros parciais | DEV 2 + DEV 1 quando houver mudança contratual | Interface clara e contrato publicado antes de adaptar o cliente |
| 3B | 5.7-B/C: retirar a superfície LAN da API e do contrato | DEV 1, depois DEV 2 | Cliente cloud-only preparado; transição compatível |
| 4 | 10.5 e 5.2: regressões e aceite em aparelhos | DEV 2; validação conjunta da API | Nenhuma perda ou duplicidade; Android físico ainda pendente |
| 5 | 10.6 e 7.1: fechar documentação e acesso | Ambos | Material corresponde ao comportamento real |
| 6 | 10.7, 8.1 e 8.2: release, vídeo e apresentação | Ambos | Versão identificada e reproduzível |

As tarefas 1A, 1B e 1C podem avançar em paralelo, sem sobrepor arquivos. Não
começar grandes funcionalidades novas antes de concluir esses critérios.

## 3. Retirada completa de LAN — tarefa 5.7

### A. Cliente e empacotamento — DEV 2

- Substituir o transporte híbrido pela chamada direta ao cliente tipado da API
  central; retirar os helpers e testes exclusivos de fallback LAN.
- Retirar `updateLocalIp`, a montagem de URL local e o uso de `localIp/localPort`
  em sessões e QR novos. Na leitura de sessões/QR legados, ignorar os campos LAN
  sem perder a credencial, o vínculo com a fazenda ou dados offline.
- Não editar `contract.d.ts` manualmente. O cliente pode deixar de usar os campos
  antes de a API deixar de enviá-los, permitindo uma transição gradual.
- Remover o script de firewall não utilizado e as expectativas de testes que o
  exigem. Não alterar regras já existentes no Windows do usuário automaticamente.
- Não introduzir permissão de rede local, servidor Tauri ou exceção de HTTP LAN
  no Android. HTTP de uma API local de desenvolvimento não é um recurso do produto.
- Ajustar textos para distinguir registro salvo localmente de confirmação da
  nuvem, sem prometer comunicação direta entre aparelhos.

**RED antes de alterar a implementação:** teste do workspace com sessão legada
contendo IP, comprovando envio somente à API configurada; testar QR antigo e novo,
falha de rede, erro de autenticação e preservação de outbox/histórico.

**Aceite:** nenhum código de produção do cliente descobre, publica ou acessa IP de
outro aparelho; o envio vai somente à API configurada. Reenvios continuam usando
os mesmos UUIDs e a ausência de internet não impede o salvamento local.

### B. Backend e contrato — DEV 1

- Retirar os endpoints `POST /devices/local-ip` e `PUT /sync/heartbeat`, seus DTOs
  e serviços exclusivos, após conferir consumidores e coordenar a publicação.
- Deixar de emitir IP/porta em pareamento e conexão; não regenerar tokens de
  dispositivos existentes nem modificar recibos de estoque.
- Retirar os campos LAN do modelo de aplicação. Para remover colunas PostgreSQL,
  usar migration nova, revisada e com backup/implantação autorizados; nunca
  reescrever migrations aplicadas nem resetar banco para limpar colunas.
- Enquanto for necessário compatibilizar versões, colunas antigas podem ficar
  inertes no banco; isso não autoriza manter transporte ou funcionalidade LAN.
- Publicar o OpenAPI pela ferramenta existente e coordenar a regeneração do
  cliente com `npm run openapi`, usando a API atualizada.

**Testes:** contrato sem as rotas removidas, pareamento manual/QR preservado,
credenciais existentes válidas e sync autenticado sem dependência de IP local.

### C. Documentação e fechamento — ambos

Remover instruções de ativação LAN/firewall de README, roteiros, arquitetura e
orientações dos agentes. Distinguir o registro histórico de uma decisão antiga
do escopo vigente. Só concluir 5.7 quando a implementação e os testes passarem.

## 4. Dados para a avaliação — tarefa 10.1, DEV 1

- Confirmar com a organização qual é a base oficial e registrar origem, versão,
  autorização e campos recebidos. Nome de arquivo/fixture não prova origem oficial.
- Identificar o seed atual como simulado até existir essa comprovação. Corrigir
  a afirmação de que sete categorias cobrem todo o Anexo III: ele apresenta oito,
  incluindo **Materiais de Irrigação**. Completar a amostra quando pertinente aos
  dados; não fabricar registros e apresentá-los como oficiais.
- Preparar carga reproduzível e não destrutiva para uma fazenda de demonstração,
  com relatório de linhas válidas, rejeitadas e tratamentos realizados.
- Conferir unidades, aliases de produto, preços/validades ausentes, datas e IDs.
  Não mesclar lotes ou produtos diferentes apenas por semelhança de nome.
- Não usar o seed atual contra um banco real: ele contém exclusões globais.
  Restringir testes a banco descartável e não executar limpeza em produção.

**Aceite:** outra pessoa consegue carregar a base autorizada em ambiente de teste
e reproduzir os resultados. Se a organização ainda não publicou a base, registrar
essa dependência, manter os simulados identificados e não concluir a validação
com dados oficiais. Não é obrigatório criar uma tela de importação CSV.

## 5. Segurança e regras — tarefas 10.2 e 10.3, DEV 1

### 10.2. Análise autorizada

Autenticar `/stock/analyze`, derivar o escopo da identidade verificada e impedir
consulta de outra fazenda mesmo quando `farmId` for forjado no body. Aplicar as
permissões documentadas dos perfis. Revisar o segredo JWT padrão no código: não
depender de um fallback público no ambiente publicado; alterações de configuração
externa exigem coordenação, não edição automática de envs.

**RED:** ausência/token inválido, fazenda alheia e perfis não autorizados.
**Aceite:** apenas consultas permitidas acessam dados da fazenda autenticada.

### 10.3. Um caminho analítico efetivamente utilizado

- Eliminar `saldoTotal` que mistura unidades; devolver agrupamento por unidade.
- Fazer o serviço usado pela rota e pela reanálise consumir o motor completo,
  incluindo parado/excesso, em vez de manter caminhos com comportamentos distintos.
- Comparar resultados API/cliente com as mesmas fixtures e a mesma data de
  referência: saldo, consumo, autonomia, validade, anomalia, ABC e prioridades.
- Conferir arredondamentos nos limiares, recência do histórico, dados ausentes e
  o ciclo de atualização dos alertas quando a situação deixa de existir.
- Não reescrever o monorepo para extrair um pacote compartilhado se alinhar o
  caminho existente com testes resolver o fechamento. Corrigir a promessa de
  paridade total enquanto ela não estiver comprovada.

**RED:** litros e quilos no mesmo conjunto; estoque parado/excesso pelo serviço
real; validade hoje; poucas amostras; limiares; listas vazias; zero; valores nulos,
ausentes e inválidos. **Aceite:** critérios coerentes, sem unidade agregada inválida
nem divergência não documentada entre tela e análise central.

## 6. Transparência para o usuário — tarefa 10.4

**DEV 2:** mostrar junto à autonomia quando a estimativa depende de poucas
amostras, explicando a janela usada. Um aviso genérico no rodapé não basta para
qualificar uma estimativa específica. Sem consumo suficiente, mostrar previsão
indisponível; não fabricar confiança estatística.

**DEV 2 + DEV 1:** preço ausente permanece desconhecido. Quando houver itens sem
preço, apresentar capital conhecido como **parcial**, indicar quais itens não
foram valorados e evitar que uma classe ABC sugira baixo valor conhecido. Zero
informado é diferente de ausência. Não somar valores monetários a quantidades.
O DEV 1 alinha os metadados da resposta se a API os publicar; contrato primeiro,
cliente depois, sem edição manual do arquivo gerado.

**RED:** sem histórico, uma/poucas/muitas amostras, todos/alguns/nenhum preço
informado, preço zero e inválidos. **Aceite:** usuário entende limites da previsão
e da cobertura financeira sem interpretar dado ausente como zero.

## 7. Regressão e aceite — tarefas 10.5 e 5.2

- Cliente: `npm test`, `npm run check` e `npm run build`.
- Nativo: `cargo test --locked --test storage` em `client/src-tauri/`.
- API: `npm test`, `npm run build` e `npm run test:sync` em infraestrutura
  PostgreSQL descartável disponível/autorizada. Mocks não comprovam locks reais.
- Exercitar perda de resposta após commit, retry com mesmo UUID, duas instalações,
  pendências criadas durante um envio, sessão expirada e restauração de backup.
- Validar a atualização sobre instalação existente, sem apagar SQLite, sessão,
  histórico ou fila. Nenhuma necessidade de editar a migration SQLite 001.
- Executar no Android real o roteiro `client/VALIDACAO_OFFLINE.md` e registrar
  evidências. **Adiado pelo usuário; a tarefa 5.2 permanece aberta.**
- Retestar Windows e Android se a remoção de LAN afetar o novo build. A aprovação
  dos instaladores anteriores não comprova a aprovação da versão modificada.

Baseline observada antes deste roadmap: 201 testes API, 254 testes cliente e
5 testes Rust aprovados. Esses números não são evidência das correções futuras.

## 8. Documentação e entrega — tarefas 10.6 e 10.7, ambos

### 10.6. Documentação verificável

- Corrigir o checklist 7.1: marcar somente o que tem evidência real.
- Informar responsável ADS, papéis, origem/tratamento dos dados, limitações e
  instruções reproduzíveis de acesso e execução.
- Publicar links diretos dos pacotes e vídeo; conferir acesso dos avaliadores.
- Declarar as ferramentas realmente utilizadas, incluindo Codex/ChatGPT, suas
  finalidades e revisões humanas; confirmar com os autores outras ferramentas.
- Alinhar a licença escolhida pelos autores entre README, arquivo de licença e
  metadados; não escolher condições de uso pela equipe sem essa decisão.
- Revisar publicação de credenciais e dados pessoais; credenciais artificiais de
  demonstração devem estar identificadas e isoladas de ambientes reais.

### 10.7. Release e apresentação

Congelar a versão depois das correções, publicar via PR para `dev`, integrar a
entrega com o fluxo existente para `main` e identificar o commit/tag avaliado.
Não sobrescrever a tag/release existente sem decisão explícita da equipe.

Gravar atualização → análise → justificativa → ação do gestor com a base do
desafio. Preparar vídeo e slides (8.1/8.2), ensaiar e conferir presença/equipamentos
(9.1–9.3). Confirmar submissão do GitHub na área da equipe e os prazos divulgados.
Não afirmar que o teste offline físico passou antes de executá-lo.

## 9. Limites de execução

Este roadmap inclui responsabilidades dos dois desenvolvedores; não é autorização
para um agente alterar a API durante uma tarefa restrita ao DEV 2. A primeira
implementação independente sugerida para o DEV 2 é **5.7-A**, seguida por 10.4.

Toda mudança funcional segue RED executado pelo motivo correto → GREEN →
refatoração → regressões. Usar branches por tarefa, Conventional Commits e PR
para `dev`, preservando alterações locais existentes. Não editar envs, contrato
gerado à mão, migrations aplicadas ou bancos reais como efeito colateral.

Fora deste fechamento: LAN (cancelada, não backlog), cotas/reservas, cursor/CDC,
estornos e inventário físico, previsão avançada/sazonalidade, histórico completo
de preços e grandes refatorações. São decisões futuras independentes; não são
pré-requisitos automáticos do regulamento nem motivo para adiar as correções acima.
