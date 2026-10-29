# 📋 Plano de Tarefas e Execução — AgroHack 2026/2 (IFRO)

> **Desafio Oficial:** Gestão Inteligente de Insumos em uma Propriedade Rural  
> **Objetivo:** Transformar registros de estoque em informações úteis para identificar problemas, antecipar necessidades e apoiar decisões de forma simples e eficiente.  
> **Apresentação:** 29 de outubro de 2026 (Semana Nacional de Ciência e Tecnologia - SNCT)  
> **Premiação:** R$ 2.000,00  
> **Formação da Equipe:** 2 integrantes  

> **Fechamento vigente (27/10):** roadmap detalhado ao final deste arquivo.
> Sincronização exclusivamente pela internet; LAN cancelada, não adiada.
> Retirada de LAN concluída no cliente, na API e no contrato (5.7).
> Teste offline Android confirmado pelo usuário; novo APK debug/cadastro em 3.10/5.8.
> Os itens 10.1–10.7 complementam este checklist com as lacunas do regulamento.

---

## 🏗️ Arquitetura e Decisões Técnicas Consolidadas

| Camada / Recurso | Tecnologia | Decisão Técnica |
| :--- | :--- | :--- |
| **Infraestrutura / Cloud** | **VPS Própria com Coolify** | Deploy contínuo do PostgreSQL e da API NestJS via Git na VPS |
| **Backend Central** | **NestJS + TypeScript** | API REST, orquestração de sincronização, autenticação e reanálise |
| **Banco Central** | **PostgreSQL + Prisma ORM** | Banco relacional na VPS gerenciado via Coolify |
| **Autenticação** | **E-mail e Senha Simples** | JWT no backend + armazenamento seguro no SQLite local (sessão persistente para nunca deslogar) |
| **Clientes** | **Tauri v2 + Vue 3 (.exe e .apk)** | **Paridade total de código:** mesma interface responsiva para Desktop e Mobile |
| **Perfis de Dispositivo** | **Nó Gestor** vs. **Nó Operador** | **Central Dinâmica:** qualquer aparelho pode ser Gestor (com login) ou Operador (via pareamento) |
| **Banco Local** | **SQLite local** (Tauri SQL Plugin) | Funcionamento **100% Offline-First** em todos os dispositivos |
| **Backup Automático** | **Snapshots SQLite (Estilo Anki)** | Snapshots atômicos diários (`VACUUM INTO`), retenção de 7 dias e restauração em 1 clique |
| **Sincronização** | **Somente internet (HTTPS)** | SQLite/outbox offline e envio direto à API central; LAN retirada do cliente, API e contrato em 5.7 |
| **Descoberta de IP** | **Cancelada** | Retirar endpoints, campos e consumo de IP local; sem mDNS nem heartbeat LAN (5.7) |
| **Firewall do Windows** | **Sem porta de sincronização local** | Script LAN retirado em 5.7-A; nenhuma regra do sistema do usuário é alterada automaticamente |
| **Pareamento Flexível** | **QR Code + Código Manual Alternativo** | Pareamento com nome do operador; funciona com ou sem câmera |
| **Inteligência de Estoque** | **Motor Híbrido (TypeScript puro)** | Regras de alertas executam localmente no SQLite e também no Backend |
| **Notificações Críticas** | **Twilio API (WhatsApp)** | Envio automático de alertas urgentes para o WhatsApp do Gestor |

---

## 👥 Matriz de Trabalho em Paralelo (2 Integrantes)

```
[ DEV 1 - Foco: Backend, Dados & Infra ]       [ DEV 2 - Foco: Frontend, Tauri & Offline ]
  ├─ Setup Coolify + VPS + PostgreSQL            ├─ Setup Tauri v2 + Vue 3 + SQLite Local
  ├─ NestJS + Prisma + Auth E-mail/Senha         ├─ Telas de Gestor vs. Operador (Vue 3)
  ├─ Endpoints de Sincronização (/sync)          ├─ Pareamento QR Code + Código Manual
  ├─ Integração Twilio WhatsApp                  ├─ Backup Automático SQLite (Estilo Anki)
  └─ Script de Seed / Carga de Dados             └─ Empacotamento do .exe e da .apk
                                      ▼
                        [ EM CONJUNTO (Reta Final) ]
     ├─ Motor de Regras e Alertas de Agronomia (TypeScript Compartilhado)
     ├─ Testes com a Base Oficial do AgroHack
     ├─ Documentação Obrigatória do README (Anexo II)
     ├─ Gravação do Vídeo Demonstrativo
     └─ Preparação e Ensaio do Pitch (29/10)
```

---

## 🚀 Roteiro de Execução em Ordem Cronológica

---

### ETAPA 0: Infraestrutura Inicial & Repositório *(Dia 1)*
*Dependência para que o restante do desenvolvimento avance.*

- [x] **0.1. [DEV 1] Setup do Coolify na VPS:**
  - [x] Criar serviço do **PostgreSQL** no Coolify.
  - [x] Obter a string de conexão (`DATABASE_URL`).
  - [x] Configurar aplicação da API NestJS no Coolify com deploy automático via Git.
- [x] **0.2. [DEV 2] Setup do Tauri v2 nos Clientes:**
  - [x] Garantir dependências de build Windows (Rust + WebView2) e Android (SDK/NDK) na máquina.
  - [x] Verificar execução inicial da pasta `client/` com Vue 3.
- [x] **0.3. [EM CONJUNTO] Governança do Repositório:**
  - [x] Conferir dados da inscrição, protocolo e chave na plataforma do AgroHack (Equipe: Oliveira & Oliveira | Protocolo: AGRO26-F009CD2F9F | Integrantes: Gabriel de Oliveira Silva e Kauê Rian Silva Conceição Oliveira — ADS 6º Período).
  - [x] Garantir que o repositório GitHub esteja público ou com acesso aos avaliadores da banca (https://github.com/GabrielOlisil/AgroHacka).
- [x] **0.4. [DEV 2] Compatibilidade da configuração Vite com ESM nativo:**
  - [x] Validar o alias `@` nos loaders `bundle` e `native`, sem avisos de incompatibilidade.
  - [x] Confirmar testes, TypeScript e build sem suprimir warnings por variável de ambiente.

---

### ETAPA 1: Modelagem Central & Banco Local *(Dias 2 a 3 — EM PARALELO)*
*Construção das duas pontas de persistência de dados.*

#### 🔹 [DEV 1] Backend Central (NestJS + Prisma + PostgreSQL)
- [x] **1.1. Modelagem Prisma (`api/prisma/schema.prisma`):**
  - [x] Criar tabelas: `Farm`, `User` (Gestor), `Device` (Operador), `Product`, `StockMovement`, `Alert`, `SyncLog`.
  - [x] Rodar migrations no PostgreSQL da VPS.
- [x] **1.2. Módulo de Autenticação Simples:**
  - [x] Endpoints `POST /auth/register` e `POST /auth/login` (E-mail + Senha com bcrypt e JWT).
- [x] **1.3. Base de Dados Simulada (Seed):**
  - [x] Criar `prisma/seed.ts` com produtos e movimentações simulando os problemas do Anexo III do regulamento (falta, vencimento, anomalia de diesel, curva ABC).

#### 🔹 [DEV 2] Banco Local Offline-First (SQLite + Tauri)
- [x] **1.4. Integração do SQLite no Tauri:**
  - [x] Instalar e configurar `@tauri-apps/plugin-sql` no projeto frontend/desktop.
  - [x] Criar script de inicialização do schema local SQLite espelhado (`products`, `movements`, `alerts`, `sync_outbox`, `app_config`).
- [x] **1.5. Persistência de Sessão Local:**
  - [x] Salvar token JWT e dados do Gestor no SQLite local para que o app nunca deslogue sem internet.
- [x] **1.6. [DEV 2] Estabilidade dos checksums das migrations locais:**
  - [x] Reproduzir a divergência LF/CRLF em teste de regressão.
  - [x] Restaurar a migration original em LF e preservar esse padrão no checkout do Git.
  - [x] Validar o checksum e a suíte de testes sem apagar ou alterar o banco existente.

> Cliente: persistência e retomada offline validadas por testes. Tokens e backups ainda não estão criptografados; a proteção por cofre nativo permanece pendente e está documentada em `client/README.md`. Senhas de login não são persistidas.

---

### ETAPA 2: Motor de Inteligência de Estoque & Regras Agronômicas *(Dias 4 a 5)*
*O coração do desafio do AgroHack — responde às 7 perguntas oficiais.*

- [x] **2.1. [EM CONJUNTO] Criação do Pacote Compartilhado de Regras (TypeScript Puro):**
  - [x] Função 1: **Normalização de Dados:** Padronização de nomes de produtos e conversão de unidades (não somar litros com quilos).
  - [x] Função 2: **Risco de Falta & Runout Time:** Cálculo de dias restantes de estoque baseado no consumo recente com justificativa clara (ex: *"Mantendo o consumo recente, o saldo será suficiente por ~8 dias"*).
  - [x] Função 3: **Risco de Vencimento:** Alerta de produtos que vão vencer antes do consumo estimado.
  - [x] Função 4: **Comportamento e Tendência:** Detecção de picos de consumo e sazonalidade.
  - [x] Função 5: **Anomalias:** Detecção de saídas fora da curva estatística da propriedade.
  - [x] Função 6: **Curva ABC & Estoque Parado:** Mapeamento de capital imobilizado e excesso de estoque.
  - [x] Função 7: **Priorização de Alertas:** Classificação em Urgente, Atenção e Normal.
- [x] **2.2. [DEV 1] Integração do Motor no Backend:** Rota `POST /stock/analyze` para reanálise central.
- [x] **2.3. [DEV 2] Integração do Motor no Frontend:** Execução local no SQLite para reanálise imediata offline.
  - [x] Calcular saldo, consumo por dias de calendário, autonomia, validade, anomalias, capital armazenado, curva ABC e alertas explicáveis a partir dos registros locais.
- [x] **2.4. [EM CONJUNTO / DEV 1] Alinhar o caminho analítico realmente utilizado (reaberta; fechada pela 10.3):** Existem funções e testes para consumo, autonomia, validade, anomalias, estoque parado e excesso. A auditoria identificou que `StockService.analyzeStock()` não usa integralmente o motor integrado; validar paridade de comportamento pela rota/serviço efetivos, sem afirmar alinhamento de 100% antes dessa comprovação.

---

### ETAPA 3: Telas, Fluxos e Pareamento *(Dias 6 a 8 — EM PARALELO)*
*Construção visual e fluxo de uso dos perfis.*

#### 🔹 [DEV 1] Endpoints de Pareamento & Sincronização
- [x] **3.1. Endpoints de Pareamento no NestJS:**
  - [x] `POST /devices/pairing-token`: Gera token de pareamento e código alfanumérico de 6 caracteres vinculado ao nome do Operador.
  - [x] `POST /devices/connect`: Valida conexão do Nó Operador.
- [x] **3.2. Endpoint de Sincronização Híbrida (`POST /sync`):**
  - [x] Recebe fila de movimentações locais com timestamp `updated_at` e UUID.
  - [x] Retorna registros novos/atualizados e recalcula alertas.
- [x] **3.3. Endpoint de Descoberta de IP (`PUT /farm/heartbeat`):**
  - [x] Implementação histórica do endpoint de IP local. *Recurso cancelado; retirada da superfície da API planejada em 5.7. Não é requisito da sincronização pela internet.*

#### 🔹 [DEV 2] Interface do Usuário (Vue 3 Responsivo)
- [x] **3.4. Tela de Boas-Vindas e Central Dinâmica:**
  - [x] Botão 🏢 *"Criar Nova Fazenda"* (Login/Cadastro do Gestor).
  - [x] Botão 📱 *"Conectar a uma Fazenda Existente"* (Fluxo do Operador).
- [x] **3.5. Pareamento Duplo (QR Code + Código Manual):**
  - [x] Modal no Gestor: digita nome do operador $\rightarrow$ exibe QR Code + Código alfanumérico (`AGRO-88`).
  - [x] Tela no Operador: leitor de QR Code pela câmera + botão alternativo *"Digitar Código Manualmente"*.
    - [x] Conexão por código manual ou conteúdo do QR Code, com validação automatizada.
    - [x] Implementar leitura por câmera e imagem QR na interface.
    - [x] Tratar negação de permissão, câmera ausente/em uso e falhas desconhecidas: fecha o vídeo e orienta usar código manual ou imagem do QR (`client/tests/app.spec.ts`).
    - [x] Garantir `CAMERA` (e câmera opcional) no `AndroidManifest.xml` gerado no CI (`client/src/scripts/garantir-permissao-camera.ts`, passo no `build-release.yml`; `client/tests/android-camera-permission.spec.ts`).
    - [x] Permissão `Câmera` aparece nas configurações do app em Android real (APK debug, 26/10): o patch do manifest funciona.
    - [x] Leitura do QR Code pela câmera validada em aparelho Android real (Motorola g75 5G, Android 16, 26/10): o QR lido conecta o aparelho.
    - [x] Conectar automaticamente ao ler o QR (câmera ou imagem), sem precisar tocar em *Conectar aparelho* (`client/tests/app.spec.ts`).
- [x] **3.6. Painéis e Paridade de Recursos:**
  - [x] **Painel Gestor:** Dashboard com Alertas Prioritários, Curva ABC, listagem de insumos e histórico.
  - [x] **Painel Operador:** Botões grandes para *Baixa Rápida de Insumo* e *Entrada de Compra* (com nome do operador bloqueado).
- [x] **3.7. [DEV 2] Refinamento visual conforme `client/design-system.md`:**
  - [x] Aplicar tokens, tipografia local, cantos retos e controles compactos a todas as telas.
  - [x] Substituir os símbolos da interface exclusivamente por ícones Lucide.
  - [x] Validar navegação acessível, regressões e layouts desktop/mobile.

> Revisão visual no navegador com dados simulados: autenticação, painéis, estoque, histórico, backups e pareamento; larguras desktop e mobile de 390/360 px. Validação final: 75 testes Vitest, checagem TypeScript e build aprovados. WebView e Android real continuam nas pendências específicas abaixo.

- [x] **3.8. [DEV 2] Integrar operadores ao fluxo de pareamento existente:**
  - [x] Listar os mesmos dispositivos criados em **Conectar operador**, em aba exclusiva do gestor, com busca e filtro de situação.
  - [x] Consultar e ocultar o código original sem criar outro operador, gerar outra credencial ou alterar o histórico.
  - [x] Usar `openapi-fetch` com o contrato gerado pelo comando do projeto; atualizar a lista após novo pareamento.
  - [x] Validar erros de rede, carregamento, permissões, respostas atrasadas e troca de sessão com testes.

- [x] **3.9. [DEV 1 + DEV 2] Consulta autenticada de operadores e recuperação do código pela API:**
  - [x] Publicar `GET /devices`, limitado à fazenda da identidade autenticada de gestor; rejeitar operador e ausência de autenticação.
  - [x] Retornar somente os campos administrativos necessários, sem `deviceToken`, com `Cache-Control: no-store` e código nulo para dispositivos inativos.
  - [x] Validar isolamento entre fazendas e consulta sem efeitos colaterais em testes de serviço, controller e HTTP.
  - [x] Integrar o contrato OpenAPI regenerado pelo usuário, sem edição manual do arquivo gerado.

> Escopo simplificado por decisão do usuário: o CRUD administrativo local separado
> e sua futura sincronização foram substituídos pela consulta dos pareamentos reais.
> Esta consulta exige API acessível e não persiste os códigos no SQLite. Nenhum dado
> local foi apagado nem migration alterada. Edição, revogação e rotação de credenciais
> não fazem parte desta entrega. Testes em WebView e aparelho real seguem pendentes.
> Validação: desktop `npm test` (134), `npm run check` e `npm run build`;
> API `npm test` (87) e `npm run build`, todos aprovados. Revisão visual no navegador
> com operadores fictícios; testes HTTP com repositório simulado, sem banco real.

---

- [x] **3.10. [DEV 2 + API autorizada] Controle de estoque do gestor:**
  - [x] Cadastrar insumos com categoria livre, unidade, mínimo, preço/validade opcionais e recebimento pelos operadores via sync; sem alterar migrations nem gerar saldo implícito.
  - [x] Facilitar busca/filtros e entradas/saídas pela aba Estoque; restringir o cadastro ao gestor.
  - [x] Simplificar textos e colocar explicações analíticas em detalhes opcionais, mantendo avisos de pendências, erros e dados ausentes.
  - [x] Validar cadastro, permissões, reenvios e interface com testes RED → GREEN e contrato gerado pelo comando do projeto.
  > 27/10: `POST /products` autenticado, lock PostgreSQL por fazenda, UUID/conteúdo estáveis e 409 sem expor fazenda alheia. Cadastro online, saldo zero até registrar entrada, download pelo sync existente. Frontend com `openapi-fetch`, contrato gerado por `npm run openapi`, SQLite preservando outbox/histórico e rascunho mantido ao fechar/reabrir o modal na sessão. 471 testes cliente, 371 testes API, 29 testes PostgreSQL descartável, TypeScript e builds aprovados. Revisão visual com dados fictícios. Novo cadastro ainda não testado no aparelho real; edição/exclusão e cadastro offline fora deste escopo.

- [x] **3.11. [DEV 2 + API autorizada] Administração de operadores e limpeza do cliente legado:**
  - [x] Conferir que `client/` é o cliente ativo; preservar configuração local exclusiva e excluir a pasta antiga sem apagar bancos do aplicativo.
  - [x] Permitir ao gestor editar nome, ativar/desativar e excluir operadores da própria fazenda.
  - [x] Preservar nomes históricos e recibos; manter somente `responsavel` nas movimentações, sem adicionar FK, conforme decisão do usuário.
  - [x] Validar permissões, exclusão concorrente com sync, contrato gerado e interface via RED → GREEN, SQLite e PostgreSQL descartável.
  > 27/10: pasta antiga removida após conferir dependências/builds/schema gerado; `.env` exclusivo copiado com hash conferido para `client/.legacy-desktop-backup/.env`, ignorado pelo Git, sem alterar configuração ativa. Teste de layout agora exige ausência da pasta inteira. Novas rotas PATCH/DELETE de dispositivos autenticadas por gestor, nome/estado editáveis e DELETE idempotente por fazenda. Nenhuma FK, schema, migration ou banco real alterado. Nomes/recibos/saldos preservados; sync bloqueia dispositivo removido/inativo inclusive na disputa pelo lock. Contrato gerado com `npm run openapi`. 463 testes cliente, 400 testes API, 32 PostgreSQL descartável, TypeScript e builds aprovados; revisão visual com dados fictícios. Validar a nova versão em Tauri/Android após publicar a API atualizada.

### ETAPA 4: Sincronização Híbrida, Backup e WhatsApp *(Dias 9 a 10 — EM PARALELO)*
*Diferenciais de peso para a banca avaliadora.*

#### 🔹 [DEV 1] Integração Twilio WhatsApp & Sync Backend
- [x] **4.1. Configuração da Conta Twilio:**
  - [x] Criar conta gratuita na Twilio e ativar a WhatsApp Sandbox.
  - [x] Configurar variáveis no Coolify (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`, e `TWILIO_CONTENT_SID` para a conta trial). *Reaberta e concluída em 26/10: depois do novo deploy, o log da API mostra "Twilio WhatsApp Client inicializado com sucesso" (ver 4.9).*
- [x] **4.2. Módulo de Disparo Automático:**
  - [x] Disparar mensagem WhatsApp para o número cadastrado do Gestor sempre que um alerta atingir nível CRÍTICO.
  - [x] Endpoint de teste manual para demonstração durante o pitch.

#### 🔹 [DEV 2] Sincronização no Cliente & Backup Estilo Anki
- [x] **4.3. Motor de Sincronização Cloud (transporte legado retirado em 5.7):**
  - [x] Implementar outbox transacional, envio à API existente com `openapi-fetch`, reenvios por UUID, proteção de pendências e download completo enquanto o backend não oferece cursor seguro.
  - [x] Validar convergência de dois SQLite locais e perda de resposta após gravação em servidor simulado, sem duplicidade de movimentações.
  - [x] Implementação histórica dos endpoints de IP local e campos de pareamento na API; não corresponde a servidor LAN funcional. Retirada planejada em 5.7.
  - [x] Registro histórico do transporte legado com fallback testado. Em 27/10, 5.7-A removeu os helpers e qualquer tentativa LAN do cliente; sessões antigas ignoram IP/porta.
  > Caminho LAN cancelado por decisão de 26/10. Não implementar servidor nem fallback local.
- [x] **4.4. Backup Automático no SQLite (Estilo Anki):**
  - [x] Snapshot atômico diário via `VACUUM INTO 'backups/backup-[data].db'`.
  - [x] Retenção automática dos últimos 7 dias.
  - [x] Tela em *Configurações > Backups* com lista e botão *"Restaurar em 1 Clique"*.
  - [x] Verificar integridade antes da restauração e criar snapshot de recuperação do estado atual, com testes nativos em SQLite real.
- [x] **4.5. [EM CONJUNTO] Proposta de regras de sincronização e concorrência:**
  - [x] Documentar em `regra_de_sync.md` idempotência, duplicidade operacional, saldo offline, protocolo de confirmação e plano de validação, distinguindo proposta de implementação atual.
- [x] **4.6. [EM CONJUNTO] Skill de implementação das regras de sync:**
  - [x] Criar orientações compartilhadas com rotas para backend e frontend, registrar seu uso no `AGENTS.md` e validar estrutura, metadados e referências.
- [x] **4.7. [DEV 1 + DEV 2] Sync cloud confiável (branch `codex/offline-stock-sync`):**
  - [x] Autenticar gestor/operador e isolar fazenda, produto e autoria.
  - [x] Persistir movimentos imutáveis e recibos individuais em transação, com conflitos explícitos.
  - [x] Adaptar o contrato e `openapi-fetch`; preservar pendências e aplicar confirmações atomicamente.
  - [x] Garantir identidade estável do rascunho, revisão de conflitos e sinalização de déficit sem descartar fatos.
  - [x] Validar retries, isolamento, convergência e concorrência com PostgreSQL descartável e SQLite real.
  - [x] Documentar limites: download completo consistente; sem cursor incremental, LAN, cotas ou estornos nesta etapa.

> Validação de 4.7: desktop `npm test` (98), `npm run check` e `npm run build`;
> API `npm test` (56), `npm run test:sync` (19) e `npm run build`, todos aprovados.
> A skill `agrohacka-sync` orientou os testes de concorrência com conexões PostgreSQL
> independentes e a aplicação atômica no SQLite. Nenhum banco real foi atualizado;
> o rollout aditivo e as limitações estão em `api/SYNC.md`. Revisão é leitura das
> tentativas preservadas, não resolução/estorno. WebView/mobile real continuam pendentes.

- [x] **4.8. [EM CONJUNTO] Alertas de emergência via WhatsApp: validação ponta a ponta, interface do gestor e segurança:**
  > Auditoria de 26/10: as tarefas 4.1, 4.2 e 6.2 entregaram o backend (envio pela Twilio com modo simulação; após um `/sync` que aceita movimentações, a reanálise grava o alerta e avisa o gestor dos alertas urgentes ainda não notificados). Faltavam a interface do gestor (a branch `feat/whatsapp-manager-ui` nunca foi mergeada), a proteção dos endpoints e a validação real.
  - [x] Auditar o que existe e o que falta (backend `NotificationsService`, `StockService.reanalyzeAndPersistAlerts`, gatilho em `SyncService`).
  - [x] Segurança: `POST /notifications/test-whatsapp` e `POST /notifications/dispatch-critical` exigem o JWT de um gestor; o teste só vai ao WhatsApp cadastrado do gestor da própria fazenda e o disparo só vale para a fazenda da identidade (`api/src/notifications/*.spec.ts`, 28 testes).
  - [x] Interface do gestor: painel *"Alertas de emergência via WhatsApp"* na Visão geral (status Ativo/Não configurado e *Testar envio de alerta*), com a sessão trazendo o `telefone` (login, cadastro e SQLite local). O teste distingue envio real, **modo de simulação** (servidor sem Twilio configurada, nada é enviado) e falha com o motivo; a API responde HTTP 200 mesmo quando a Twilio recusa (`client/tests/whatsapp-alerts*.spec.ts`).
  - [x] Número do gestor: o gestor cadastra, troca ou desativa o WhatsApp depois do registro (`PATCH /auth/telefone` e campo no painel). O número é normalizado para `+<dígitos>` no cadastro, na edição e no envio; antes um número digitado como `+55 69 99999-9999` chegava inválido à Twilio. **O gestor do seed continua com o número fictício `+5569999999999` até ser trocado pelo painel.**
  - [x] Validar em produção: `TWILIO_*` no Coolify (log *"Twilio WhatsApp Client inicializado"*), celular do gestor conectado ao *Try out WhatsApp* e recebimento real de uma mensagem pelo *Testar envio de alerta* (26/10, passos na 4.9). O ensaio do alerta automático está na 4.9.
  - [x] Roteiro da demonstração: o alerta é gravado uma vez por produto e tipo e não se resolve sozinho, então um novo lançamento no mesmo insumo não reenvia a mensagem. Para repetir a demonstração, marcar os alertas da fazenda como resolvidos (`UPDATE alerts SET resolvido = true WHERE "farmId" = '<id>'`); a próxima sincronização os recria e notifica (README §4.4).
  - [x] Documentar no README os pré-requisitos (variáveis `TWILIO_*`, conexão do celular de teste, número com código do país) e os limites (um aviso por alerta, só nível urgente) (README §4.4; atualizado na 4.9 para o fluxo *Try out WhatsApp*).

- [x] **4.9. [EM CONJUNTO] Twilio no fluxo novo *Try out WhatsApp* e o nono dígito dos celulares brasileiros:**
  > Descoberto em 26/10 ao conectar o celular do gestor: a conta usa o fluxo novo da Twilio, com remetente próprio (`+1 737 250 8034`) e código `join twilio-trial`; o Sandbox antigo compartilhado (`+1 415 523 8886`) recusa o código. O `join` só foi reconhecido com o número de teste verificado **sem o 9 depois do DDD**, que é como o WhatsApp identifica esse celular.
  - [x] Diagnóstico do fluxo novo e do nono dígito (confirmado pelo usuário em 26/10).
  - [x] API exige `TWILIO_PHONE`: sem ele, ou com valor inválido, roda em modo de simulação com aviso no log, em vez de usar o Sandbox antigo como padrão (`api/src/notifications/notifications.config.spec.ts`).
  - [x] `.env.example` e README §4.4 atualizados: remetente do Console, um número de teste por vez, 100 mensagens grátis e a regra do nono dígito (`api/src/notifications/env-example.spec.ts`).
  - [x] Coolify: configurar `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_PHONE=+17372508034` e refazer o deploy da API. Concluído em 26/10: a API só lê as variáveis ao iniciar, então foi preciso refazer o deploy depois de defini-las. Diagnóstico de 26/10: a API publicada inicia com *"Twilio não configurado"*; o painel do app já salva o número no formato verificado (sem o 9) e o teste chega à API, mas fica em simulação até as variáveis existirem. Depois do deploy, o log deve mostrar *"Twilio WhatsApp Client inicializado com sucesso"*.
  - [x] Levar `dev` para a `main` para publicar a API que exige `TWILIO_PHONE`, os endpoints de telefone e de teste e o app com o painel (PRs #47 e #51; release `v1.0.0-entrega` recompilada em 26/10 com Windows, Android e publicação em `success`). Deploy da API no Coolify confirmado pelo log de inicialização.
  - [x] Conta trial exige modelo: o envio de texto livre falhou com `ContentSid Required` (26/10). A API passa a enviar o modelo quando `TWILIO_CONTENT_SID` está definido, com `TWILIO_CONTENT_VARIABLES` opcional; sem eles, segue o texto formatado (`api/src/notifications/notifications.template.spec.ts`). Nesse modo o WhatsApp leva o texto do modelo da Twilio e o detalhe do alerta fica no app.
  - [x] Coolify: definir `TWILIO_CONTENT_SID` com o `ContentSid` de um modelo pronto do *Try out WhatsApp* (os modelos disponíveis não têm variáveis, então `TWILIO_CONTENT_VARIABLES` fica vazio) e refazer o deploy. Sem avisos de valor ignorado no log (26/10).
  - [x] No app, entrar como gestor, salvar o WhatsApp **no mesmo formato do número de teste verificado** (sem o 9) e tocar em *Testar envio de alerta*: a mensagem do modelo chegou ao celular e o app confirmou o envio real, sem "modo de simulação" (26/10).
  - [x] Ensaiar o alerta automático: marcar os alertas como resolvidos, registrar uma saída que deixe um insumo urgente, sincronizar e confirmar o WhatsApp. Validado em 26/10: a sincronização com uma saída gerou 4 alertas, 2 de `ESTOQUE_CRITICO` (`ALTA`, `notificadoWhatsapp = true`, um WhatsApp para cada) e 2 de atenção (`CONSUMO_ANOMALO` e `RISCO_VENCIMENTO`, `MEDIA`, só no app). Para repetir na gravação, rodar o `UPDATE` do README §4.4 antes.

---

### ETAPA 5: Empacotamento do .exe e .apk *(Dia 11)*
*Geração dos artefatos finais para entrega.*

- [x] **5.1. [DEV 2] Build do Desktop (.exe) com Regra de Firewall:**
  - [x] Configurar pipeline de compilação Windows no GitHub Actions (`.github/workflows/build-release.yml`) restrito à branch `main` e tags `v*`.
  - [x] Embutir script pós-instalação para liberar porta TCP local no Firewall do Windows (`client/scripts/liberar-firewall.bat`):
    `netsh advfirewall firewall add rule name="AgroHack Local Server" dir=in action=allow protocol=TCP localport=3333 profile=private`
    > Registro histórico: o script existia, mas o instalador não o executava. Em 27/10, 5.7-A retirou o script e os testes que o exigiam, sem alterar o firewall do usuário.
  - [x] Build Windows executado no GitHub Actions na `main` (26/10): `.exe` e `.msi` publicados na release `v1.0.0-entrega`, substituindo os de 21/10 (que apontavam para `localhost`).
  - [x] `.exe` da release instalado no PC de desenvolvimento (26/10): abre e sincroniza com a nuvem.
  - [x] Testar instalação limpa em máquina Windows sem versão anterior instalada (concluído pelo usuário em 26/10).
- [x] **5.2. [DEV 2] Build do Mobile (.apk):**
  - [x] Configurar pipeline de compilação Android (.apk) no GitHub Actions (`.github/workflows/build-release.yml`) com Java, Android SDK, NDK e targets Rust.
  - [x] APK debug instalado em celular Android real (26/10): abre, login com as contas do seed funcionando contra a API.
  - [x] Testar o funcionamento offline em celular Android real (modo avião, movimentação e sincronização ao reconectar).
    - [x] Preparar roteiro reproduzível com persistência após reabrir, confirmação no gestor e novo sync sem duplicidade: `client/VALIDACAO_OFFLINE.md`.
    > Teste físico confirmado com sucesso pelo usuário em 27/10. Aceite referente ao APK já instalado; o novo APK e o novo cadastro exigem validação própria.
    > Regressão DEV 2 em `test/dev2-offline-readiness`: 254 testes Vitest, checagem TypeScript, build da interface e 5 testes Rust de transação/backup aprovados. Sem alterações na API, contrato, envs ou migrations; sem novo APK/instalador nesta etapa.
  - [x] App respeita as barras do sistema no aparelho real (insets), confirmado em 26/10.
  - [x] `.apk` da release gerado pelo GitHub Actions instalado e funcionando no aparelho (26/10). O download direto pelo navegador do celular corrompeu o arquivo de 155 MB ("problem parsing the package"); o mesmo arquivo enviado pelo WhatsApp instalou. Baixar no PC e transferir.
- [x] **5.3. [DEV 2] Corrigir falha do build do .apk no GitHub Actions (job `Build Mobile Android (.apk)`):**
  - [x] Diagnosticar o erro do log de 22/10 (`errobuildnadroid.txt`): a compilação Android já passava; o Gradle executa `npm run tauri android android-studio-script` e o script `tauri` era `tauri dev`, que subia o Vite e rodava `cargo run` do app desktop no host Linux, onde o `gdk-sys` quebrava sem `gdk-3.0.pc`. O GTK era só o sintoma.
  - [x] Corrigir na origem: `"tauri": "tauri"` e novo `tauri:dev` para o fluxo de desenvolvimento; removido o passo paliativo de `libglib2.0-dev`/`pkg-config` do workflow.
  - [x] Gerar `.apk` instalável: build em modo `--debug` (o release sai sem assinatura e o Android recusa instalar).
  - [x] Injetar `VITE_API_URL` de produção no workflow: `.env.production` não é versionado e, sem a URL, o `client.ts` lançava erro no import e o app abria em branco.
  - [x] Tratar o modo edge-to-edge: `client/src/scripts/aplicar-insets-android.ts` aplica na `MainActivity` gerada o padding das barras do sistema, recorte e teclado.
  - [x] Confirmar a execução do job no GitHub Actions até publicar o `.apk` na release: run da `main` (26/10) com Windows, Android e publicação em `success`; o APK do CI foi inspecionado (`com.agrohack.desktop.debug`, assinado, `arm64-v8a`, com `CAMERA`) e está na release `v1.0.0-entrega`.
- [x] **5.4. [DEV 2] Conectar automaticamente ao ler o QR Code:** após ler o QR pela câmera ou por imagem, o aparelho conecta sozinho (como no WhatsApp). Leituras vazias ou repetidas são ignoradas e erros da API aparecem na tela (`client/tests/app.spec.ts`).
- [x] **5.5. [DEV 2] Painel de conciliação só onde importa:** *"Estoque conhecido e registros locais"* deixa de aparecer em todas as abas; só aparece na aba Estoque e quando há pendências, saldo confirmado negativo ou registros para revisão (`client/tests/app.spec.ts`).
- **5.6. [EM CONJUNTO] Servidor LAN — CANCELADA por decisão de 26/10:** não implementar e não manter como backlog. Substituída pela retirada dos resíduos em 5.7; não foi concluída como funcionalidade.
- [x] **5.7. [DEV 2 + DEV 1] Remover completamente a funcionalidade LAN e sincronizar somente pela internet:**
  - [x] Registrar decisão, responsabilidades, ordem de publicação e critérios no roadmap ao final deste arquivo.
  - [x] **A — DEV 2:** substituir o transporte híbrido por API direta e retirar helpers, publicação/uso de IP, script de firewall e testes exclusivos de LAN; preservar sessões/QR legados ignorando os campos locais.
    > Implementado em 27/10 na branch `feat/dev2-cloud-only-and-analysis`. `cloud-only.spec.ts` valida ausência de chamada LAN inclusive com sessão antiga, compatibilidade e falhas; `cloud-restart.spec.ts` verifica persistência em SQLite temporário no disco, reabertura e retry com resposta perdida sem duplicidade. API e contrato gerado não foram alterados.
  - [x] **B — DEV 1:** retirar endpoints/DTOs de IP e heartbeat, emissão dos campos LAN e código exclusivo; coordenar compatibilidade e eventual migration nova, sem reset de banco.
    > 27/10: removidos `POST /devices/local-ip`, `PUT /sync/heartbeat`, seus DTOs e serviços; pareamento e conexão não devolvem IP/porta; a base simulada não tem campos LAN. **Sem migration:** `localIp`/`localPort` ficam inertes no `schema.prisma`, porque o deploy roda `prisma db push` e removê-las derrubaria a subida da API por perda de dados. `lan-removal.http.spec.ts` comprova 404 nas rotas, QR e código manual sem IP e o OpenAPI sem as rotas.
  - [x] **C — DEV 1 + DEV 2:** publicar contrato pela ferramenta existente, regenerar por `npm run openapi` e atualizar documentação/orientações dos agentes, sem editar o contrato gerado à mão.
    > 27/10: `contract.d.ts` regenerado com `npm run openapi` contra a API local (Postgres descartável). O contrato passou a declarar o cabeçalho `authorization` e incluiu `/auth/telefone`, então `client.ts` passou a usar `params.header` em `testWhatsApp` e o `PATCH` tipado em `updateTelefone`. Skill `agrohacka-sync` atualizada (somente nuvem), README e `api/SYNC.md`.
  - [x] **Aceite do cliente em testes automatizados:** sessão antiga com IP envia apenas à API configurada; sem internet, salvar/reabrir mantém a outbox; retry não duplica; nenhum servidor, permissão ou regra de firewall LAN exigido. O teste físico permanece em 5.2.

---

- [ ] **5.8. [DEV 2] Manter APK debug e validar a nova versão:**
  - [x] Decisão de 27/10: manter debug por solicitação do usuário. A assinatura release personalizada foi cancelada nesta entrega, sem pendência de configurar chave/secrets.
  - [x] Restaurar `--debug --target aarch64 --ci` e publicar somente os APKs em `outputs/apk/**/debug/*.apk`; manter falha explícita quando não houver artefato.
  - [x] Remover preflight de secrets, assinatura manual, script/testes exclusivos de release e instruções de configuração de chave.
  - [x] Executar RED → GREEN do empacotamento: 2 falhas esperadas antes da mudança, depois 10 testes aprovados.
  - [x] Regressão após a volta ao debug: `npm test` com 434 testes aprovados e `npm run check` aprovado. A redução de 471 para 434 corresponde à retirada dos testes exclusivos da assinatura release, não à remoção dos testes de estoque/interface.
  - [x] Executar o CI e validar o novo APK debug/cadastro no aparelho. O aceite de 5.2 corresponde à versão anterior; não apagar SQLite nem desinstalar para atualizar. Validado pelo usuário em 27/10/2026.
  - [x] Corrigir publicação Android após push na `main` e pausar o build de PC (27/10): job Windows preservado como comentário; publicação depende apenas do Android. Na `main`, cria pré-release `android-build-<run_number>` no commit compilado; tags `v*` continuam publicando releases oficiais. RED: 3 falhas esperadas; GREEN: 23 testes de empacotamento/câmera, regressão com 539 testes e TypeScript aprovados; YAML validado com apenas os jobs Android e publicação ativos.
  - [ ] Confirmar o primeiro APK publicado pelo workflow corrigido após integração na `main` (complementa 10.7). A execução anterior `40600736900` compilou Android e Windows com sucesso, mas pulou a publicação por exigir tag `v*`.

### ETAPA 6: Carga da Base Oficial, Testes e Limitações *(Dias 11 a 12)*
*Critério de 15 pontos da banca avaliadora.*

- [x] **6.1. [DEV 1] Comprovar e carregar a base oficial do AgroHack (reaberta; ver 10.1):**
  - [x] Disponibilizar seed programático e testes com cenários de falta, vencimento, anomalia e capital parado; existem 2 operadores demonstrativos e as 8 categorias do Anexo III representadas.
  - [x] Confirmar a origem oficial dos registros: em 27/10/2026 a organização informou que **não haverá base oficial** e que as equipes devem criar os dados. A base é identificada como `SIMULADO` no campo `origem` de `official-seed.data.ts` (nome histórico) e no README §5.2.
  - [x] Corrigir a cobertura: adicionada a categoria Materiais de Irrigação (simulada), totalizando as 8 categorias do Anexo III. Não há dados oficiais a demonstrar.
  > O seed antigo excluía globalmente os dados antes de recriar a amostra. Desde a tarefa 10.1 ele usa a carga não destrutiva de `demo-load.ts`.
- [x] **6.2. [DEV 2] Validação da Reanálise em Tempo Real:**
  - [x] Registrar uma saída que deixe um insumo crítico e comprovar o recálculo imediato do alerta na tela e o disparo no WhatsApp (implementado `reanalyzeAndPersistAlerts` com persistência na tabela `Alert`, disparo pelo `NotificationsService` e recálculo no cliente via `refresh` -> `analyzeInventory`, testado em `stock.service.spec.ts` e `realtime-reanalysis-offline.spec.ts`).
- [x] **6.3. [EM CONJUNTO] Validação do Modo Offline:**
  - [x] Validar automaticamente persistência offline, rollback e reenvio idempotente entre dois SQLite e um servidor simulado.
  - [x] Desligar Wi-Fi/4G (modo avião), fazer movimentações no cliente, reconectar e confirmar a sincronização sem duplicidade com UUIDs preservados e liquidação atômica de pendências (`client/tests/realtime-reanalysis-offline.spec.ts`).

- [x] **6.4. [EM CONJUNTO] Registro de Limitações:**
  - [x] Documentar arquitetura do cliente, critérios locais, execução, testes e limites de integração em `client/README.md`.
  - [x] Mapear o que a solução faz com excelência e documentar limitações conhecidas de forma transparente.
  - [x] Registrar a decisão de sincronizar pela internet e cancelar LAN; a limpeza dos resíduos de implementação permanece aberta em 5.7.

---

### ETAPA 7: Documentação Obrigatória (README Anexo II) *(Dia 12)*
*Critério rigoroso do regulamento do IFRO.*

- [ ] **7.1. [EM CONJUNTO] Fechar o README e as evidências de entrega (reaberta após revisão do regulamento; ver 10.6):**
  - [x] 1. Equipe (nomes, cursos, papéis e identificação explícita do responsável ADS). *Responsável ADS: Gabriel de Oliveira Silva (definido pela equipe em 27/10).*
  - [x] 2. Problema e público (contexto rural, Gestores e Operadores).
  - [x] 3. Solução (arquitetura híbrida, Central Dinâmica e paridade Desktop/Mobile).
  - [x] 4. Como testar (instruções reproduzíveis e links diretos dos instaladores). *Release `v1.0.4-entrega` (27/10, com a Etapa 11) com `.exe`, `.msi` e `.apk`; link no README §4 e §10.*
  - [x] 5. Dados e critérios (origem comprovada da base, tratamentos e limites das análises). *Sem base oficial (confirmado pela organização em 27/10); base simulada, tratamentos e limites no README §5 e §5.2 (tarefas 10.1 e 10.3).*
  - [x] 6. Demonstração (vídeo final informado pela equipe em 27/10: https://youtu.be/Pwy9RCFmI4M; link incluído no README §6 e §10).
  - [x] 7. Validação e testes (resultados observados e limitações da solução).
  - [x] 8. Tecnologias e declaração de IA (incluir as ferramentas efetivamente usadas, finalidades e revisão humana). *Claude Code, Codex/ChatGPT e Gemini, confirmados pela equipe em 27/10.*
  - [ ] 9. Autoria e licença (alinhar licença e metadados e revisar a publicação de credenciais/dados).
    > Licença MIT alinhada em 27/10: `LICENSE`, README e `license` em `package.json` (raiz, api, client) e `Cargo.toml`. **Pendente:** um telefone pessoal ficou no histórico do git (commit `8d5c1b4`, já removido da ponta); apagá-lo exige reescrever o histórico, decisão da equipe.
  - [x] 10. Versão de entrega (tag e hash do commit). *A versão avaliada passa a ser `v1.0.4-entrega`, com o app na versão 1.0.4 (as tags anteriores ficam preservadas). Tags `v*` publicam releases oficiais; a correção de 5.8 adiciona pré-releases Android por execução na `main`.*

---

### ETAPA 8: Vídeo Demonstrativo e Preparação do Pitch *(Dia 13 — Pré-Apresentação)*
*Entregáveis para a banca antes do dia 29/10.*

- [x] **8.1. [EM CONJUNTO] Gravação do Vídeo Demonstrativo (3 a 5 min):**
  - [x] Roteiro: *`roteiro_video_demonstrativo.md`, com pré-requisitos, ações na tela e plano B (27/10).*
    1. Abertura: Dores do produtor rural (falta inesperada e dinheiro parado).
    2. Demonstração do Painel do Gestor com alertas críticos e Curva ABC.
    3. Pareamento rápido do Operador via QR Code e via Código Alfanumérico.
    4. Operador lançando saída no celular em modo 100% offline.
    5. Sincronização automática e reanálise instantânea dos alertas na tela.
    6. Recebimento do alerta urgente no WhatsApp via Twilio.
    7. Demonstração do backup automático e restauração em 1 clique (estilo Anki).
  - [x] Vídeo final publicado no YouTube e link incluído no `README.md`: https://youtu.be/Pwy9RCFmI4M (informado pela equipe em 27/10; duração e configuração de visibilidade não verificadas pelo agente).
- [ ] **8.2. [EM CONJUNTO] Produção dos Slides do Pitch:**
  - [x] Apresentação visual focada em: Problema -> Solução Híbrida -> Demonstração Prática -> Impacto no Bolso do Produtor -> Limitações. *Deck de 12 slides com notas do apresentador (27/10); números da base simulada e dos testes. Duração do pitch ainda não divulgada pela organização.*
  - [ ] Salvar versão final em PDF no repositório.

---

### ETAPA 9: Apresentação Final na SNCT *(29/10/2026)*
*O grande dia no IFRO Campus Ariquemes.*

- [ ] **9.1. [EM CONJUNTO] Ensaio do Pitch:** Cronometrar o tempo de fala e divisão entre os 2 integrantes.
- [ ] **9.2. [EM CONJUNTO] Alinhamento para a Sabatina:** Preparar respostas sobre regras do negócio rural, consistência offline e uso ético de IA.
  - [x] Respostas preparadas e conferidas no código (27/10): negócio, regras e alertas, offline, segurança, IA, técnico e limitações, com divisão sugerida entre os integrantes (material da equipe, fora do repositório).
  - [ ] Alinhar as respostas entre os dois integrantes.
- [ ] **9.3. [EM CONJUNTO] Checklist Presencial:** Notebooks carregados, `.exe` rodando offline, celular com a `.apk` instalada e presença confirmada.

---

### ETAPA 10: Fechamento após auditoria do regulamento (26/10)

Ordem, dependências e critérios detalhados na seção de roadmap ao final deste arquivo.
Não são funcionalidades já concluídas. A retirada de LAN está em 5.7; seu servidor
foi cancelado em 5.6. O aceite físico Android anterior foi confirmado em 5.2;
o novo APK debug e as novas telas ainda exigem validação em 5.8/10.5.

- [x] **10.0. [EM CONJUNTO] Registrar o roadmap de finalização e a decisão de sincronizar exclusivamente pela internet.**
- [x] **10.1. [DEV 1] Dados verificáveis:** fechar 6.1 com origem/autorização da base, identificação dos simulados, tratamento documentado e carga reproduzível não destrutiva.
  - Sem base oficial (confirmado pela organização em 27/10/2026); dados identificados como simulados.
  - `api/src/stock/demo-load.ts`: validação com relatório de linhas válidas, rejeitadas e tratamentos (unidades, preço/validade ausentes, datas, refs duplicadas sem fusão por nome) e carga transacional que não apaga nada e não faz nada se o gestor de demonstração já existir. `prisma/seed.ts` deixou de apagar tabelas globalmente.
  - Testes: `demo-load.spec.ts` (casos de borda) e `test/demo-load.postgres.integration.ts` (PostgreSQL descartável: atomicidade, idempotência, outras fazendas intactas).
- [x] **10.2. [DEV 1] Proteger `/stock/analyze`:** escopo pela identidade autenticada, testes de fazenda forjada e acesso negado; revisar dependência do segredo JWT padrão, sem editar envs automaticamente.
  - A rota exige o JWT do Gestor ou o `x-device-token` de um operador ativo (os dois perfis já veem a análise no app; a rota só lê dados). A fazenda vem da identidade; `farmId` divergente ou que não é texto recebe 403 (`stock.controller.spec.ts`, via HTTP).
  - `auth/jwt-secret.ts`: em produção a API não inicia sem `JWT_SECRET` próprio; o valor público de desenvolvimento é recusado (`jwt-secret.spec.ts`).
  - **Antes do próximo deploy (`dev` → `main`):** conferir no Coolify se `JWT_SECRET` está definido com valor próprio. Se faltar ou for o valor do `.env.example`, a API não sobe. Trocar o segredo encerra as sessões de gestor abertas (é preciso fazer login de novo); os operadores pareados não são afetados.
- [x] **10.3. [DEV 1] Corrigir unidades e unificar a análise efetiva:** fechar 2.4, remover saldo agregado entre unidades distintas e comprovar falta, validade, anomalias, parado/excesso e prioridades no caminho realmente utilizado.
  - `StockService.analyzeStock` (rota e reanálise) usa `analyzeStockInventory`; o caminho antigo com regras próprias foi removido. Sem `saldoTotal`: saldos em `balancesByUnit`.
  - `analyzeStockInventory` alinhado ao cliente: preço ausente fica desconhecido (não R$ 0), aviso de base limitada, confiabilidade e amostras, autonomia sem arredondar e alertas ordenados (antes a ordenação era descartada).
  - `parity.spec.ts` roda API e cliente com as mesmas fixtures e data de referência: base simulada, litros/quilos, validade hoje/vencida/30/31 dias, poucas amostras, limiares 7/15/90/91 e saldo = mínimo, janela da anomalia, parado, zerado/negativo, preço zero/ausente, futuras e listas vazias.
  - Ciclo dos alertas: situação que deixou de existir é resolvida; atenção → urgente atualiza o alerta e volta a notificar (`stock.service.spec.ts`).
- [x] **10.4. [DEV 2 + DEV 1 quando houver contrato] Transparência analítica:**
  - [x] **DEV 2:** expor amostras, dias de calendário e base limitada/intermediária/ampliada por produto; explicitar que não é garantia de duração. Alertas de falta/validade/excesso com apenas 1–2 retiradas também avisam sobre a base limitada.
  - [x] **DEV 2:** valor/ABC desconhecidos permanecem nulos; indicar subtotal parcial, quantidade de insumos com saldo sem preço e indisponibilidade quando nenhum estiver valorado; preço zero informado continua válido.
  - [x] **DEV 2:** validar cálculo e interface com listas vazias/nulas, amostragem, dados ausentes, zero e inválidos (`analysis-disclosure.spec.ts`, `app.spec.ts`).
  - [x] **DEV 1:** alinhar a interpretação financeira e analítica no caminho da API efetivamente usado (10.3); se publicar metadados novos, coordenar a geração do contrato e a adaptação do cliente.
    > Feito pela 10.3: a análise da API devolve valor/ABC nulos sem preço, `pricedProductCount`/`unpricedProductCount`, amostras, dias e confiabilidade, iguais ao cliente. `parity.spec.ts` cobre sem histórico, poucas/muitas amostras, todos/alguns/nenhum com preço e preço zero. A resposta de `/stock/analyze` não tem schema no contrato e o cliente não a consome, então não houve adaptação de cliente.
- [ ] **10.5. [DEV 2 + DEV 1] Regressão integrada:**
  - [x] **DEV 2:** 538 testes do cliente, checagem TypeScript, build da interface e 5 testes Rust aprovados em 27/10; reabertura offline e resposta perdida validadas com SQLite temporário real e servidor simulado. Revisão visual no navegador com dados fictícios (não substitui aparelhos). Sem novo APK/instalador, mudança de API, contrato, envs ou migrations.
  - [x] **Regressão automatizada de 27/10 no `dev` (`fe618e9`, já com a Etapa 11):** API com 400 testes e build OK; integração PostgreSQL descartável (`npm run test:sync`, Docker) com 32 testes; cliente com 510 testes, `npm run check` e build OK. Os testes Rust não rodaram localmente (sem Rust na máquina).
  - [ ] Revalidar versão final integrada, PostgreSQL descartável, atualização de instalação e aparelhos. Cliente, API, builds e testes Rust foram revalidados em 27/10/2026; a integração PostgreSQL não pôde iniciar porque o Docker Desktop não estava acessível nesta sessão. A validação física da atualização da instalação final permanece necessária.
    > Baseline anterior: `dev` com 10.1–10.4 e 5.7 tinha 245 testes API, 24 PostgreSQL e 283 cliente. Antes da volta ao debug, 3.10/5.8 passou com 371 API, 29 PostgreSQL, 471 cliente, TypeScript e builds. Os scripts/testes de assinatura release foram depois removidos por decisão do usuário; o resultado atual do cliente fica registrado em 5.8. Código Rust inalterado; os 5 testes nativos anteriores não foram reexecutados. **Faltam:** execução CI, atualização/instalação do novo APK debug e teste do cadastro em aparelhos.
- [ ] **10.6. [EM CONJUNTO] Fechar documentação verificável:** concluir 7.1, origem dos dados, responsável, links dos pacotes/vídeo, declaração de IA efetiva e licença consistente.
- [ ] **10.7. [EM CONJUNTO] Congelar e publicar a versão avaliada:** PRs para `dev`, fluxo existente de release, commit/tag identificável e conclusão das tarefas 8/9 sem alegar testes não executados.

---

### ETAPA 11: Melhorias de UI/UX — mobile first e offline first (análise de 27/10)
*Análise completa das telas nos dois perfis. A interface está boa e consistente; o problema principal é de fluxo: o app foi organizado em torno do painel do gestor no computador, e o operador no campo (celular, offline) ficou com o caminho mais longo. Cada item segue TDD (RED → GREEN → refatoração) e é só de cliente, sem API, contrato ou banco.*

**Prioridade 1 — tarefa principal do operador (fazer antes da apresentação)**
- [x] **11.1. Operador movimenta pela aba Estoque:** Entrada/Saída em cada insumo também para o operador, com o mesmo modal do gestor; o cadastro de insumo continua só do gestor (`manager-stock.spec.ts`).
- [x] **11.2. Registro antes dos alertas para o operador:** "Movimente seu estoque" vem antes da lista de alertas na Visão geral do operador (`order` via classe `actions-first`); o gestor mantém alertas em largura total em cima (`whatsapp-alerts.spec.ts`).
- [x] **11.3. Confirmação junto ao formulário:** "Salvo no aparelho · sincronização pendente" e os erros aparecem logo abaixo do botão Salvar da Visão geral (`app.spec.ts`).
- [x] **11.4. Prevenir erro na quantidade:** saldo e unidade do insumo escolhido; aviso, sem bloquear, quando a saída passa do saldo (regra offline: registra e o gestor revisa); `inputmode="decimal"` no formulário e no modal (`app.spec.ts`, `manager-stock.spec.ts`).
- [x] **11.5. Corrigir acoplamento:** o gráfico "Consumo ao longo do tempo" tem seleção própria (`chartProductId`) e não muda mais o insumo do formulário; o modal usa o insumo do formulário (`app.spec.ts`).
- [x] **11.6. Alvos de toque de 44–48 px no celular:** `--control-md` 44 px e `--control-lg` 48 px até 760 px; abas do menu com 48 px, rótulos inteiros e rolagem lateral quando não cabem (`mobile-touch.spec.ts`).

**Prioridade 2 — offline first e navegação no celular**
- [x] **11.7. Status de sincronização claro:** "Offline · N registro(s) pendente(s)", "N registro(s) pendente(s) de envio", "Tudo enviado · HH:MM" e "Sincronizando…", reagindo aos eventos `online`/`offline`; offline em destaque (`app.spec.ts`). `navigator.onLine` indica rede, não a API: as pendências seguem como fonte do que não chegou à nuvem.
- [x] **11.8. Histórico no celular em cartões, com etiqueta de situação** em cada registro: "Esperando envio" (ainda só neste aparelho) ou "Enviado". No celular a tabela vira cartões, com o mesmo estilo do Estoque. O workspace expõe `pendingIds` (`cloud-only.spec.ts`); teste da tela em `app.spec.ts` e do CSS em `mobile-touch.spec.ts`.
- [x] **11.9. Navegação inferior no celular** (zona do polegar), até 4 itens. O gestor vê Visão geral, Estoque, Histórico e Mais (Operadores e Cópias); o operador vê Visão geral, Estoque, Histórico e Cópias. No computador, o menu lateral não muda. Testes em `app.spec.ts` (Mais abre, navega e fecha) e `mobile-touch.spec.ts` (menu fixo embaixo, abas de 56 px, conteúdo não fica coberto).

**Prioridade 3 — depois da apresentação**
- [x] **11.10. Visão geral por perfil:** o capital em estoque fica só para o gestor. O operador vê "Insumos acompanhados" e "Atenção imediata" lado a lado, além dos alertas e dos saldos. Não há filtro por "o que o operador usa": o sistema não registra essa relação. Teste em `app.spec.ts`.
- [x] **11.11. Busca na escolha do insumo:** com mais de 5 insumos, aparece "Buscar insumo" acima da lista. A busca ignora acento e maiúsculas, e o insumo já escolhido nunca some da lista.
- [x] **11.12. Sugestão de destinos recentes:** até 4 botões com os destinos mais recentes do histórico, sem repetir. Um toque preenche o campo. Vale na Visão geral e na janela de entrada/saída do Estoque.
- [x] **11.13. Data e hora atrás de "alterar":** o formulário mostra "Data: agora · alterar". Sem alterar, o registro recebe a hora do salvamento, e não a hora em que o formulário foi aberto. Vale nos dois formulários. Testes das três tarefas em `app.spec.ts`.

**Linguagem (pedido do usuário em 27/10: o público é rural, não técnico)**
- [x] **11.14. Telas sem termos de informática:** "Atualizar agora" (sincronizar), "Sem internet" (offline), "lançamentos esperando envio" (pendências), "Cópias de segurança" (backups), "código de acesso" (pareamento), "Saldos a conferir" (conciliação), "Saldo confirmado / Com os lançamentos deste aparelho" (confirmado/provisório), "Precisa de internet para cadastrar…" (requer internet), sem IDs técnicos e com a data no nome das cópias. `plain-language.spec.ts` percorre todas as telas e modais dos dois perfis e a tela de entrada e falha se aparecer jargão.
- [x] **11.15. Textos dos alertas em linguagem simples:** os dois motores (cliente e API) passam a dizer "Restam 20 L, no mínimo ou abaixo do mínimo de 50 L. Com o uso médio de 5,65 L por dia (últimos 23 dias), dura cerca de 3,5 dia(s).", "Previsão com poucos dados…; pode mudar", "Venceu em DD/MM/AAAA", "devem sobrar cerca de…", "15,8 vezes a média", "nenhuma retirada nos últimos 30 dias", "Considere a época do ano"; números com vírgula e sem ponto de milhar. Rótulos da estimativa: "Poucos dados / Dados razoáveis / Bons dados". `alert-language.spec.ts` cobre todos os tipos; `parity.spec.ts` segue exigindo textos idênticos; o teste de linguagem simples passa a incluir os alertas.
- [x] **11.22. WhatsApp no formato brasileiro:** o campo do número (cadastro e painel do gestor) mostra e aceita `(69) 91234-1234`, formatando enquanto a pessoa digita; o app acrescenta o +55 ao salvar, então a API não mudou. Exige DDD e celular de 9 dígitos; número colado com +55 também é aceito; em branco continua desativando. O número salvo aparece sem o +55 nas mensagens da tela. Testes em `phone.spec.ts` e `whatsapp-alerts.spec.ts`.
- [x] **11.21. Toque no ícone de data/hora abre o seletor:** no Firefox, um toque no ícone nativo não abria o calendário nem a hora. O ícone abre o seletor sozinho, e o `showPicker()` chamado por cima fazia ele fechar. Agora o toque nos últimos 40 px do campo, onde fica o ícone, fica com o navegador, e o resto do campo continua chamando `showPicker()`.
  - A primeira tentativa (#99) escondeu o ícone nativo e desenhou outro. O Firefox não deixa esconder o ícone nativo, então apareciam dois. Essa tentativa foi revertida.
  - Testes em `open-picker.spec.ts` e `mobile-touch.spec.ts`. O usuário confirmou no Firefox.
- [x] **11.20. Urgente em vermelho:** o nível urgente (selo e borda dos alertas e o resumo "Atenção imediata") deixa o marrom e passa a usar `--color-danger: #b42318`, que tem contraste AA com texto branco. Teste em `urgent-color.spec.ts`.
- [x] **11.19. Data e hora em campos separados:** o seletor combinado do navegador (calendário e hora juntos) vazava pela direita da tela no celular. Agora são dois campos, "Data" e "Hora", cada um com um seletor menor, nos dois formulários. Conferido a 414 px. Testes em `app.spec.ts`.
- [x] **11.18. Calendário abre ao tocar no campo de data:** em alguns navegadores e WebViews, o calendário só abria pelo ícone, ou não abria. Agora um toque em qualquer parte de "Data e hora" (nos dois formulários) e de "Validade" chama `showPicker()`. Onde não há suporte, o campo continua funcionando normalmente. Testes em `app.spec.ts` e `product-form.spec.ts`; conferido no Edge a 414 px com toque real.
- [x] **11.17. Janelas cabem na tela do celular:** a janela "Novo insumo" passava da borda direita. A coluna do fundo das janelas passa a ser `minmax(0, 1fr)`, o que corrige todas as janelas. Conferido a 414 px: a janela termina em 398 px e a página não rola para o lado. Teste em `mobile-touch.spec.ts`.
- [x] **11.16. "Conectar operador" só na aba Operadores:** o botão saiu do cabeçalho das outras abas (`app.spec.ts`); título "Operadores conectados".

---

### ETAPA 12: Final presencial (30/10/2026, 19h15, Auditório do CEI)
*Origem: regras da final e parecer consolidado da seleção, ambos de 28/10/2026. A banca dá nota nova, de zero: C1 problema (20), C2 funcionamento e demonstração (20), C3 análises e apoio à decisão (20), C4 validação e testes (15), C5 código, documentação e IA (15), C6 clareza e respostas (10). O desempate usa C3, depois C2, depois C1. Na seleção, a equipe ficou em 4º (80,25); o C3 (14,75) foi o critério mais fraco.*

*Comparação com as outras seis finalistas (parecer do Claude). O que as mais bem avaliadas têm e nós não temos:*
- *ação recomendada concreta em cada alerta, incluindo quantidade e custo da compra (3 Hacketeers, BDCACO, Aridev, Tetrarreme);*
- *pontuação de prioridade documentada dentro de cada nível e resumo para o gestor no topo (3 Hacketeers, Hype Stack);*
- *reanálise que mostra o que mudou depois do registro: alertas novos, resolvidos e que mudaram de nível (3 Hacketeers, Hype Stack);*
- *página "Como funciona" com os critérios e as sete perguntas do desafio (3 Hacketeers, Hype Stack);*
- *teste-gabarito: cada problema plantado gera o alerta esperado e os produtos normais não geram nenhum (Hype Stack, Tetrarreme, 3 Hacketeers);*
- *aviso fixo de dados simulados na tela (3 Hacketeers, Tetrarreme, Aridev);*
- *importação de nova base (cinco das seis).*

*Fraquezas comuns que podemos explorar:*
- *quase ninguém tem retorno de produtor ou da Agronomia;*
- *a revisão humana do código gerado por IA raramente está registrada;*
- *nenhuma concorrente tem app de celular nativo com sincronização ativa e WhatsApp; a Tetrarreme funciona offline no navegador, mas não sincroniza.*

*Prazo: melhorias até **30/10 às 14h**. Depois disso, o repositório fica congelado. Cada item de código segue TDD (RED → GREEN → refatoração). Mudanças no motor de análise valem nos dois motores, cliente e API, com o `parity.spec.ts` passando.*

**Divisão para trabalhar em paralelo.** Cada um fica com um conjunto de arquivos, para que nenhum precise esperar o outro e os PRs não entrem em conflito.
- **DEV 1 (Kauê) — motor de análise e API:** `api/src/**`, `client/src/offline/analysis.ts` e os testes deles, incluindo o `parity.spec.ts`.
- **DEV 2 (Gabriel) — telas, documentação e entrega:** `client/src/App.vue`, `client/src/components/`, `client/src/style.css`, `client/src-tauri/tauri.conf.json`, `.github/workflows/` e `README.md`.

| Ordem | DEV 1 (Kauê) | DEV 2 (Gabriel) |
| --- | --- | --- |
| 1 | 12.3 credenciais da demonstração e a parte de API da 12.2 | 12.19 nome (depois da escolha conjunta) e 12.12 restos de modelo |
| 2 | 12.10 teste-gabarito, que serve de base para as regras novas | 12.8 aviso de dados simulados e 12.20 resumo no topo |
| 3 | 12.5 ação recomendada | 12.17 o que mudou depois do registro |
| 4 | 12.6 ordem por gravidade | 12.18 tela "Como funciona" |
| 5 | 12.11 registro da falha da reanálise | 12.9 testes do cliente no CI |
| 6 | 12.7, se der tempo | 12.13 README e 12.1 tag e release |

**Por que ninguém espera ninguém:**
- a ação recomendada (12.5) entra no próprio texto do alerta, que a tela já exibe; não precisa mudar a interface;
- o resumo (12.20) e o "o que mudou" (12.17) usam o nível e o tipo dos alertas, que já existem hoje;
- o DEV 2 escreve a tela "Como funciona" e o README com as regras atuais; o DEV 1 descreve, na descrição de cada PR, o texto das regras novas, e o DEV 2 só acrescenta no fim.

**Marcos:**
- **29/10 até 23h:** todo o código na `dev`;
- **30/10 até 12h:** `dev` → `main`, release e tag (12.1);
- **30/10 às 14h:** congelado.

Juntos: 12.14 no dia 29; 12.15 e 12.16 no dia 30 depois das 14h; 12.4 no dia 30; 12.21 por último (depois das outras tarefas ou no dia 30, o que acontecer primeiro).

**Prioridade 1 — obrigatório para a final**
- [ ] **12.1. [DEV 2] Versão final identificada e informada até 30/10 às 14h** (qualquer um dos dois pode mandar a mensagem à organização): criar uma tag única num commit da `main` (por exemplo `v1.1.0-final`), com a release e os instaladores publicados; usar essa mesma referência no README e no roteiro; informar a tag à organização pelo canal de entrega.
  - Corrigir as divergências apontadas no parecer: o README cita `android-build-21` como versão de entrega, mas o link baixa a release mais recente; o roteiro do vídeo cita `v1.0.4-entrega`, que não existe.
  - Preparado em 28/10 pelo DEV 1, só em commit local (branch `chore/versao-1-1-0`), para revisão do Kauê em 29/10:
    - app na versão **1.1.0** (`tauri.conf.json`, `Cargo.toml`, `Cargo.lock` e teste);
    - README §10 com a tag `v1.1.0-final` e o que ela traz;
    - roteiro do vídeo sem a tag inexistente (o vídeo de 28/10 é da 1.0.4, release `android-build-22`).
  - Resultado: cliente com 590 testes, checagem de tipos e build aprovados; API com 385 testes e build aprovados.
  - Feito em 29/10:
    1. PR #129 para a `dev`;
    2. PR #130, da `dev` para a `main`;
    3. tag `v1.1.0-final` no commit `fcd6266` da `main`;
    4. release conferida, com `.exe`, `.msi`, `app-portable.exe`, `.apk` e `.AppImage` da versão 1.1.0.
  - Em 29/10, a pedido do Kauê, o "O que fazer" passou para linha própria, em negrito (PR #133). Para entrar na versão avaliada: app **1.1.1** e tag nova `v1.1.1-final`; a `v1.1.0-final` fica como versão anterior.
  - Ainda em 29/10, o Kauê pediu tags só com a versão, sem `-final`: a versão avaliada passou a ser a tag `v1.1.1`. As tags `v1.1.0-final` e `v1.1.1-final` ficam como anteriores.
  - Ainda em 29/10, a paginação (12.22, PR #138) entrou na versão avaliada: app **1.1.2** e tag `v1.1.2`. A `v1.1.1` fica como anterior.
  - **Falta:** informar a tag `v1.1.2` à organização.
- [ ] **12.2. [EM CONJUNTO] Demonstração ao vivo com reanálise (C2):** na final, slides e vídeos não substituem a demonstração. Preparar no notebook o app desktop com a fazenda de demonstração e um roteiro para registrar uma movimentação ao vivo e mostrar a reanálise.
  - **DEV 1:** confirmar que a fazenda de demonstração está na API publicada e que o login funciona. Essa é a pergunta 21 do parecer.
  - **DEV 2:** deixar o notebook com o app instalado, a fazenda sincronizada e o roteiro da demonstração.
  - Ter dois planos B: sem internet, o app registra e reanalisa no aparelho; se o notebook falhar, os vídeos.
- [x] **12.3. [DEV 1] Credenciais públicas da fazenda de demonstração:** a senha e os tokens fixos de `official-seed.data.ts` estão no repositório. Conferir se funcionam na API publicada. Se funcionarem, trocar a senha do gestor de demonstração e desativar os aparelhos fictícios, sem apagar dados.
  - Aceite: os tokens do repositório recebem 401 na API publicada.
  - Em 28/10, a senha e os dois tokens do repositório funcionavam na API publicada (200). A senha do gestor de demonstração foi trocada direto no banco, com hash bcrypt gerado localmente; a senha nova não está no repositório. Os aparelhos `tok_tratorista_01` e `tok_almoxarife_02` foram desativados, sem apagar dados. No novo teste, a senha antiga e os dois tokens receberam 401. Sessões abertas e o celular pareado por QR Code continuam funcionando.
  - `agro1234` continua valendo só para quem roda a carga localmente; o README deve dizer isso (12.13).
- [ ] **12.4. [EM CONJUNTO] Logística da final:**
  - os dois presentes no CEI antes das 19h15 (atraso ou ausência de qualquer integrante desclassifica a equipe);
  - notebook carregado, com carregador e adaptador HDMI;
  - cópia local dos slides, vídeos e dados;
  - internet alternativa testada.

- [x] **12.19. [EM CONJUNTO escolhe · DEV 2 aplica] Dar um nome ao software:** "AgroHacka" é o nome do repositório, não do produto. Todas as outras finalistas têm nome próprio.
  - O nome não pode repetir nem imitar o de outro participante: AgroSentinela, AgroMind, Monitora, AgroAlerta, CampoCerto, AgroZica, AGROGADO, AgroInsight, Arvô, CultivaStock, AgroGestão Intelligence e AgroSense. Também não pode ser o nome do evento (AgroHack).
  - Escolher em conjunto. Sugestões: **Paiol** (o depósito da fazenda), **Tulha**, **Celeiro** e **Galpão em Dia**.
  - Aplicar na tela de entrada, no título da janela, no `productName` do Tauri, no README, nos slides e no roteiro.
  - **Não mudar o `identifier` do Tauri.** Ele define onde fica o banco local; trocar faria a instalação por cima perder os dados do aparelho. Conferir com teste antes do merge.
  - **Nome escolhido em 28/10: Paiol** (o depósito da fazenda onde se guardam grãos, sementes e insumos).
  - Aplicado pelo DEV 1, a pedido da equipe: marca da tela de entrada e do menu, rodapé ("Paiol · versão …"), título da página (`index.html`) e título da janela (`tauri.conf.json`).
  - **`productName` mantido como `agrohacka`, de propósito:** no Windows ele define a pasta de instalação, e trocá-lo faria a versão nova ser instalada ao lado da antiga, como outro programa. Por isso só o nome do arquivo do instalador continua `agrohacka_…`. O `identifier` não mudou.
  - Testes em `app.spec.ts`: marca, rodapé, título, `productName` e `identifier`. Cliente com 583 testes, checagem de tipos e build aprovados.
  - README aplicado no PR #128 (12.13); slides com o nome Paiol na capa desde 28/10.

**Prioridade 2 — análises e apoio à decisão (C3, peso 20 e primeiro desempate)**
- [x] **12.5. [DEV 1] Ação recomendada em todos os alertas:** cada alerta termina com o que fazer. A mudança vale nos dois motores; a tela já mostra o texto do alerta.
  - Falta: quanto comprar (o suficiente para 30 dias de uso, sem ficar abaixo do mínimo) e o custo estimado, quando houver preço.
  - Vencimento: usar primeiro e não repetir a compra nesse volume.
  - Fora do padrão: conferir a retirada.
  - Parado e excesso: não comprar até girar.
  - Testes: sem consumo, saldo zerado, saldo acima da meta, preço ausente, poucos dados e unidades diferentes.
  - Feito em 28/10, nos dois motores (`analysis.ts` e `stock-engine.ts`). Todo alerta termina com "O que fazer: …", depois do aviso de poucos dados.
  - **Regra da compra (para o README, 12.13):** quantidade = maior valor entre o mínimo e 30 dias do uso médio, menos o saldo (saldo negativo conta como zero), arredondada para cima.
    - Mostra o custo quando o insumo tem preço.
    - Diz "para 30 dias de uso" ou "para voltar ao mínimo", conforme o que pesou mais.
    - Sem retiradas recentes, volta ao mínimo.
    - Com o saldo exatamente no mínimo e sem uso, pede reposição antes da próxima retirada.
    - Exemplo da base simulada: "comprar cerca de 127 sc (cerca de R$ 20320) para 30 dias de uso".
  - **Textos dos outros alertas:**
    - vencido: "separar o produto vencido e confirmar com o responsável técnico antes de usar ou descartar";
    - perto de vencer: "usar este produto primeiro e não repetir a compra nesse volume";
    - fora do padrão: "conferir com quem retirou se a quantidade está certa";
    - parado: "não comprar mais até voltar a ter saída" (substitui "Avalie antes de comprar mais");
    - excesso: "não comprar mais até o estoque baixar".
  - Testes: `alert-language.spec.ts` (cliente: todos os tipos, custo, sem preço, saldo negativo, saldo no mínimo, mínimo maior que 30 dias de uso, ordem depois do aviso de poucos dados) e `official-seed.spec.ts` (API: todo alerta da base simulada termina com a ação; Ureia com 127 sc e R$ 20320). A paridade garante textos idênticos nos dois motores.
  - Resultado: API com 382 testes e build aprovados; cliente com 542 testes e checagem de tipos aprovados. As 4 falhas de `build-packaging.spec.ts` já existiam na `dev` (o workflow mudou em `ed1ab38`/`fa9f0f2` sem atualizar o teste) e ficam para a 12.9.
- [x] **12.6. [DEV 1] Ordem dentro de cada nível:** hoje, dentro de um mesmo nível, os alertas seguem o identificador.
  - Ordenar pela gravidade: falta por menos dias restantes, vencimento por maior sobra, fora do padrão por maior múltiplo da média, desempatando pelo valor em jogo.
  - Escrever o critério na descrição do PR, para o DEV 2 levar ao README (12.13).
  - Feito em 28/10, nos dois motores.
  - **Critério (para o README e a tela "Como funciona"):**
    1. nível: urgente → atenção → informativo;
    2. tipo, dentro do nível: falta → vencimento → fora do padrão → parado → excesso (a falta para a operação; o vencimento é perda certa);
    3. gravidade, dentro do tipo:
       - falta: menos dias restantes primeiro, e sem previsão por último;
       - vencimento: maior valor da sobra em R$ (o vencido conta todo o saldo), e sem preço por último;
       - fora do padrão: maior múltiplo da média;
       - parado e excesso: maior valor em estoque;
    4. desempate: maior valor em estoque, depois o identificador.
  - O `prioritizeAlerts`, que só ordenava pelo identificador, deixou de ser usado e foi removido com seus 2 testes.
  - Na base simulada, a ordem passa a ser:
    1. Ureia;
    2. vencimento do Trichoderma;
    3. Diesel;
    4. MAP (R$ 147.000), Respirador e Bicos;
    5. excesso do Trichoderma.
  - Testes:
    - `client/tests/alert-order.spec.ts` (novo): ordem completa com os 5 tipos nos 3 níveis, empate pelo valor, sem previsão, sem preço, independência da ordem de entrada e lista vazia;
    - gabarito da base simulada (`official-seed.spec.ts`) e `stock.service.spec.ts` atualizados para a nova ordem;
    - a paridade garante a mesma ordem nos dois motores.
  - Resultado:
    - API: 380 testes e build aprovados (menos os 2 do `prioritizeAlerts`);
    - cliente: 545 testes e checagem de tipos aprovados; continuam só as 4 falhas de empacotamento que já existiam (12.9).
- [x] **12.20. [DEV 2] Resumo no topo da Visão geral:** uma frase para o gestor, por exemplo: "3 compras urgentes, 1 retirada para conferir". Usa o nível e o tipo dos alertas, que já existem.
  - Feito em 28/10 pelo DEV 1, a pedido da equipe.
  - Exemplo: "Hoje: 2 compras urgentes, 1 produto vencido ou vencendo hoje, 1 retirada para conferir e 3 insumos parados ou sobrando."
  - Ordem dos grupos (`client/src/alert-summary.ts`):
    1. compras urgentes;
    2. vencidos ou vencendo hoje;
    3. compras para planejar;
    4. perto de vencer;
    5. retiradas para conferir;
    6. consumo em alta;
    7. parados ou sobrando.
  - Sem alertas, a frase é "Hoje: nenhum alerta, estoque em dia.". Só o gestor vê o resumo, e ele não aparece numa fazenda sem insumos.
  - Testes:
    - `alert-summary.spec.ts` (novo): vazio, singular, ordem e conectivos, urgente × planejar, dois grupos;
    - `app.spec.ts`: o gestor vê; o operador e a fazenda vazia, não.
  - Resultado: cliente com 567 testes, checagem de tipos e build aprovados, mais as 4 falhas de empacotamento que já existiam.
- [x] **12.7. [DEV 1] Retirada fora do padrão na janela inteira e consumo crescente (se der tempo):**
  - a regra atual olha só a última retirada; passar a avaliar todas as retiradas da janela de 30 dias;
  - avaliar um alerta de consumo crescente, comparando os últimos 15 dias com os 15 anteriores, com limiar explicado.
  - Feito em 28/10, nos dois motores. Responde à pergunta 23 do parecer.
  - **Fora do padrão (para o README e a tela "Como funciona"):**
    - cada retirada com ao menos 3 retiradas antes dela na janela de 30 dias é comparada com a média dessas anteriores;
    - o alerta aponta a de maior múltiplo e agora diz a data, por exemplo "Retirada de 950 L em 18/10/2026, 15,8 vezes a média…".
  - **Consumo crescente** (tipo novo, atenção, limiar escolhido pela equipe):
    - compara o uso médio por dia dos últimos 15 dias com o dos 15 anteriores;
    - a metade anterior conta a partir da primeira retirada, para não confundir início de uso com aumento;
    - exige 2 ou mais retiradas em cada metade e avisa a partir de 50% a mais;
    - texto: "O uso médio subiu de X por dia para Y por dia nos últimos 15 dias, Z% a mais que nos 15 dias anteriores…";
    - O que fazer: "conferir se o aumento era esperado e antecipar a próxima compra se ele continuar".
  - Ordem no mesmo nível: falta → vencimento → fora do padrão → consumo crescente → parado → excesso.
  - O consumo crescente não é gravado na tabela de alertas da API (não está em `PERSISTED_TYPES`) e não vai para o WhatsApp, que só leva urgentes. Aparece na análise do app e na rota `/stock/analyze`.
  - A base simulada não ganha alerta novo: a Ureia, que começou a ser usada há 17 dias, não é marcada como crescente.
  - Testes:
    - `client/tests/alert-trend.spec.ts` (novo): pico no meio da janela com data, dois picos, menos de 3 retiradas antes, abaixo de 3 vezes, crescente com a conta, exatamente 50%, abaixo de 50%, menos de 2 retiradas por metade, início de uso e ordem;
    - `parity.spec.ts`: cenário novo;
    - gabarito da API: nenhum crescente na base e um caso positivo;
    - `alert-language.spec.ts`: o texto com data.
  - Resultado:
    - API: 385 testes e build aprovados;
    - cliente: 555 testes e checagem de tipos aprovados, mais as 4 falhas de empacotamento que já existiam (12.9).
- [x] **12.8. [DEV 2] Aviso fixo de dados simulados na fazenda de demonstração (C6):** o parecer apontou que só o README e os dados dizem isso.
  - Feito em 28/10 pelo DEV 1, a pedido da equipe:
    - na fazenda da carga de demonstração ("Fazenda Modelo AgroHack", sem diferenciar maiúsculas nem espaços), uma faixa fixa abaixo da barra superior diz: "Dados simulados: esta fazenda de demonstração e seus números foram criados pela equipe, não são de uma propriedade real.";
    - vale para o gestor e o operador, em todas as abas, com `role="note"`;
    - não aparece em outras fazendas nem na tela de entrada.
  - Limitação: o app reconhece a fazenda pelo nome. Uma fazenda real com esse mesmo nome também mostraria o aviso.
  - Testes em `app.spec.ts` (3 novos, RED antes da faixa). Cliente com 560 testes, checagem de tipos e build aprovados, mais as 4 falhas de empacotamento que já existiam.
- [x] **12.17. [DEV 2] Mostrar o que mudou depois do registro (C2 e C3):** depois de salvar uma movimentação, a tela informa os alertas novos, os resolvidos e os que mudaram de nível. É a reanálise que a banca precisa ver na demonstração ao vivo.
  - Feito em 28/10 pelo DEV 1, a pedido da equipe.
  - Como funciona: antes de salvar, o app guarda os alertas; depois, compara com a análise nova (`client/src/alert-changes.ts`) e mostra "O que mudou na análise", em três partes:
    - "Novo alerta (urgente): …";
    - "Mudou de atenção para urgente: …";
    - "Resolvido: …".
  - Mudança só na conta, no mesmo alerta e nível, não conta. Sem mudança, aparece "Nenhum alerta mudou com este registro.".
  - Onde aparece:
    - junto ao formulário da Visão geral;
    - no aviso do topo, quando o registro vem da janela da aba Estoque.
  - O quadro some na próxima ação ou no cadastro de insumo.
  - Testes:
    - `alert-changes.spec.ts` (novo): ordem, mudança só de conta, listas vazias, primeira análise;
    - `app.spec.ts`: formulário com mudança e sem mudança;
    - `manager-stock.spec.ts`: entrada pela aba Estoque resolve a falta do Diesel.
  - Resultado: cliente com 573 testes, checagem de tipos e build aprovados, mais as 4 falhas de empacotamento que já existiam.
- [x] **12.18. [DEV 2] Tela "Como funciona" (C1, C3 e C6):** explica em linguagem simples cada alerta, o limiar usado, de onde vem a conta e quais das sete perguntas do desafio cada tela responde. O conteúdo é estático e não muda a API.
  - Feito em 28/10 pelo DEV 1, a pedido da equipe, em `client/src/components/HowItWorks.vue`.
  - Conteúdo:
    - o que o app faz;
    - tabela dos 8 alertas, com quando aparecem, prioridade e o que fazer;
    - de onde vem a conta: uso médio, duração, quanto comprar, "Poucos dados", curva ABC, unidades e dados ausentes;
    - em que ordem os alertas aparecem;
    - os limites, escolhidos pela equipe e a ajustar com a Agronomia;
    - as sete perguntas do desafio, com onde ver cada resposta no app.
  - Acesso:
    - no computador, item "Como funciona" no menu, para os dois perfis;
    - no celular do gestor, pelo "Mais";
    - para todos, inclusive o operador no celular, pelo link "Como os alertas são calculados" no painel de alertas.
  - O teste de linguagem simples cobre a tela; "nuvem" foi trocada por "envia os registros".
  - Testes em `app.spec.ts`: gestor pelo menu, operador pelo link, e os testes de navegação atualizados para o item novo.
  - Resultado: cliente com 575 testes, checagem de tipos e build aprovados, mais as 4 falhas de empacotamento que já existiam.

**Prioridade 3 — testes, código e documentação (C4 e C5)**
- [x] **12.9. [DEV 2] Testes do cliente na integração contínua:** hoje só a API roda testes no GitHub Actions.
  - Feito em 28/10 pelo DEV 1, a pedido da equipe.
  - `ci.yml`:
    - job novo `test-client`, com `npm ci`, `npm test` e `npm run check` do cliente. O `VITE_API_URL` só de teste fica no próprio job, porque o `.env.test` não é versionado e o fetch é simulado;
    - o CI passa a rodar também nos pushes e PRs da `dev`, além da `main`.
  - `build-packaging.spec.ts`: os 4 testes que falhavam descreviam o workflow antigo, só Android. Agora seguem o atual:
    - Windows, Linux e Android, com publicação só se os três builds passarem;
    - release como a mais recente, com `prerelease: false` e `make_latest`;
    - GTK só no job Linux.
  - 2 testes novos conferem o CI do cliente.
  - Antes, corrigir as 4 falhas de `client/tests/build-packaging.spec.ts`: o teste ainda espera só o build Android, mas o workflow voltou a ter Windows e Linux (`ed1ab38`, `fa9f0f2`).
- [x] **12.10. [DEV 1] Teste-gabarito da base simulada com o motor de produção:** `official-seed.spec.ts` deve usar `analyzeStockInventory`.
  - Cada problema plantado gera exatamente o alerta esperado, e os produtos normais não geram nenhum alerta extra.
  - Remover as funções antigas de `stock-engine.ts` usadas só em testes; uma delas trata preço ausente como zero.
  - Feito em 28/10. O gabarito roda a base simulada com data fixa (20/10/2026) no `analyzeStockInventory`, o mesmo motor da API, e exige a lista exata de alertas na ordem de prioridade:
    - falta urgente da Ureia;
    - fora do padrão do Diesel (950 L, 15,8 vezes a média);
    - vencimento do Trichoderma (atenção) e excesso (informativo);
    - parado do MAP, dos Bicos e do Respirador.
  - Calcário, Semente Milho e Mangueira de Gotejamento não geram alerta. O MAP é classe A, com R$ 147.000.
  - O gabarito passou de primeira, porque o motor já acertava. Teste de mutação: com a regra de fora do padrão trocada de 3 para 30 vezes a média, 2 testes do gabarito falharam; a mudança foi desfeita.
  - As funções antigas (`normalizeUnitAndName`, `calculateRunoutTime`, `checkExpiryRisk`, `detectConsumptionAnomalies`, `checkStagnantAndExcess` e `calculateAbcCurve`) e seus 22 testes foram removidos. A ABC antiga tratava preço ausente como zero.
  - API: 380 testes e build aprovados (eram 400: menos 22 testes antigos, mais 2 do gabarito).
- [x] **12.11. [DEV 1] Registrar a falha da reanálise:** em `sync.service.ts`, a falha é descartada em silêncio; passar a registrá-la no log, sem derrubar a sincronização.
  - Feito em 28/10:
    - a falha agora vai para o log de erro do NestJS (`Logger`), com a fazenda, o motivo e a pilha;
    - a sincronização continua sendo concluída e os recibos são devolvidos normalmente;
    - o log aparece no Coolify.
  - Testes em `sync.service.spec.ts`:
    - a reanálise falha, o sync conclui e o erro é registrado com a fazenda e o motivo;
    - sem movimentações aceitas, não há reanálise nem log.
  - Resultado: API com 382 testes e build aprovados.
- [x] **12.12. [DEV 2] Remover restos de modelo:** `HelloWorld.vue` e o README padrão do NestJS em `api/`.
  - Feito em 28/10 pelo DEV 1, a pedido da equipe:
    - `HelloWorld.vue` removido, junto com os dois `vi.mock` que o simulavam nos testes (o app nunca o usava);
    - `api/README.md` reescrito: o que a API faz, os comandos reais do `package.json`, onde está cada parte e links para as seções do README principal.
  - Teste: `client/tests/template-leftovers.spec.ts` falhava com os restos (RED) e passou depois da remoção.
  - Resultado: cliente com 557 testes, checagem de tipos e build aprovados (mais as 4 falhas de empacotamento que já existiam, da 12.9).
- [x] **12.13. [DEV 2] README** (com os textos de regras que o DEV 1 deixa na descrição dos PRs das tarefas 12.5 a 12.7):
  - Feito em 28/10 pelo DEV 1, a pedido da equipe. Mudanças:
    - nome Paiol no título;
    - instruções locais completas: `.env`, PostgreSQL por Docker, `prisma migrate deploy` antes da carga e a senha `agro1234` só para o banco local;
    - regras novas (fora do padrão na janela, consumo crescente, o que fazer, quanto comprar, ordem dos alertas e "o que mudou");
    - origem dos limites: parâmetros da equipe, sem referência publicada, a calibrar com a Agronomia;
    - saíram "sazonalidade", "Detecção Estatística", "anomalia grave" e o "desvio estatístico" do roteiro;
    - correção de "desapercebidos" e da frase herdada da IA ("O usuário confirmou…");
    - testes atualizados (API 385, app 589, CI), teste-gabarito, uso em aparelho real e a falta de retorno do público;
    - novas limitações: previsão, importação, lote/preço por produto e retorno do público;
    - tabela de revisão humana do uso de IA;
    - data e local da final.
  - A seção 10 (versão de entrega) fica para a 12.1, junto com a tag.
  - Teste: `client/tests/readme.spec.ts` (6 testes, RED antes das correções).
  - instruções locais completas: `.env`, subir o PostgreSQL e aplicar as migrations antes da carga;
  - origem dos limiares: dizer que são parâmetros da equipe, ou citar referências;
  - tirar o que vai além do código: "sazonalidade", "detecção estatística" e anomalia "grave", que no app é atenção;
  - corrigir "desapercebidos" e a frase herdada da IA ("O usuário confirmou…");
  - tabela de revisão humana do uso de IA: que parte, quem revisou e o que foi conferido;
  - registrar o retorno da 12.14.
- [ ] **12.14. [EM CONJUNTO] Retorno do público (C4):** mostrar o app a pelo menos uma pessoa do público, como produtor, estudante ou professor de Agronomia, e registrar o retorno sem dados pessoais.

**Prioridade 4 — apresentação e sabatina**
- [ ] **12.15. [EM CONJUNTO] Apresentação de até 10 minutos:**
  - montar a demonstração ao vivo da 12.2 dentro da apresentação;
  - atualizar os slides com a versão final e as melhorias da Etapa 12;
  - ensaiar com cronômetro: até 10 minutos, mais 3 de perguntas.
- [ ] **12.16. [EM CONJUNTO] Sabatina:** preparar respostas para as perguntas 21 a 25 do parecer e para os limites que não serão resolvidos a tempo:
  - importação de nova base;
  - preço, validade e lote por entrada, não por produto;
  - cadastros duplicados;
  - variação de preço.

  A banca pode perguntar a qualquer integrante, então os dois estudam tudo. Atualizar o baralho do Anki.
- [ ] **12.21. [EM CONJUNTO] Revisão final da apresentação (por último):** fazer depois de todas as outras tarefas ou no dia 30/10, o que acontecer primeiro.
  - Conferir se os slides, as falas e os vídeos refletem a versão final: nome do software (12.19), ações recomendadas (12.5), ordem por gravidade (12.6), resumo no topo (12.20), "o que mudou" (12.17), tela "Como funciona" (12.18) e a tag da versão (12.1).
  - Regravar os vídeos que mostram telas que mudaram.
  - Cronometrar a apresentação completa com a demonstração ao vivo: no máximo 10 minutos, com folga.
  - Conferir os números citados (testes, alertas, valores da base) contra o app e o README.
  - Atualizar as respostas da sabatina e o Anki com o que mudou.
- [x] **12.22. [DEV 1] Paginação das listas que crescem:** pedida pelo Kauê em 29/10. Histórico, Estoque e Operadores mostram 25 itens por página, com escolha de 10, 25, 50 ou 100, botões Anterior e Próxima, "Página X de Y" e "Mostrando 1–25 de N". A página volta para a 1 quando a busca, o filtro ou o tamanho da página mudam. Com até 10 itens, a barra não aparece.
  - Fora da paginação: Cópias (no máximo 7) e Alertas (a lista é ordenada por gravidade; paginar poderia esconder um alerta urgente).
  - A paginação é feita no app, sobre os dados que já estão no aparelho; a API não muda.
  - Testes: `pagination.spec.ts`, `pagination-bar.spec.ts`, `app.spec.ts` e `operators-panel.spec.ts` (RED antes de cada parte). Cliente com 606 testes, checagem de tipos e build aprovados.

**Fora do escopo até a final (responder como limitação):** importação de arquivo (cinco das seis concorrentes têm; a resposta é a carga de demonstração reproduzível e o cadastro pelo app), lotes por entrada, detecção de duplicados, variação de preço e a divisão do `App.vue` (cerca de 1.700 linhas). São mudanças grandes demais para fazer com segurança até 30/10 às 14h.

---

## Roadmap detalhado de finalização

Atualizado em 27/10/2026, com base na revisão do regulamento e da `dev` em
`32f958f`. Consolidado neste arquivo na tarefa 10.0: ordem, responsáveis,
dependências e critérios de aceite. Os checkboxes das etapas 5 e 10 distinguem
as entregas concluídas das pendências; o planejamento não comprova execução.

Referência: [regulamento oficial](https://incubadora.cloud/agrohack/assets/regulamento-agrohack.pdf),
especialmente seções 4, 6 e 7 e Anexos I–III. A apresentação é em 29/10; confirmar
nos canais da organização o prazo específico de submissão e a duração permitida.

### 1. Escopo decidido

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

**Estado atual (27/10):** 5.7 concluída no cliente, API e contrato, com transporte
direto à API e sem helpers LAN. Sessões/QR antigos ignoram os campos locais sem
perder credenciais. As tarefas 10.1–10.4 também foram concluídas na `dev`;
a organização confirmou que os dados devem ser simulados, sem base oficial.
As demais pendências seguem os checkboxes acima, que registram o estado de execução.

Também foi implementada a parte local de 10.4: amostragem junto à previsão,
financeiro parcial e itens sem preço fora da ABC. A tarefa 3.10 acrescenta cadastro
online de insumos e ações de estoque. Regressão atual: 471 testes cliente, 371
API, 29 PostgreSQL, TypeScript e builds aprovados antes da volta ao debug (resultado
atual do cliente em 5.8). Aceite Android anterior confirmado pelo usuário;
novo APK debug/cadastro aguardam validação em 5.8.
Nenhum novo APK/instalador foi publicado nesta alteração.

### 2. Ordem de execução e paralelismo

| Ordem | Tarefa | Responsável | Dependência / conclusão |
| --- | --- | --- | --- |
| 1A | 5.7-A: retirar LAN do cliente | DEV 2 | Independente; sessões antigas continuam funcionando |
| 1B | 10.1: verificar e preparar os dados do desafio | DEV 1 | Confirmar fonte oficial; simulados identificados |
| 1C | 10.2: proteger a análise de estoque | DEV 1 | Isolamento por identidade autenticada |
| 2 | 10.3: corrigir unidades e unificar a análise utilizada | DEV 1 | Mesmos cenários e critérios do cliente |
| 3A | 10.4: incerteza e valores financeiros parciais | DEV 2 + DEV 1 quando houver mudança contratual | Interface clara e contrato publicado antes de adaptar o cliente |
| 3B | 5.7-B/C: retirar a superfície LAN da API e do contrato | DEV 1, depois DEV 2 | Cliente cloud-only preparado; transição compatível |
| 4 | 10.5, 5.2 e 5.8: regressões e aceite em aparelhos | DEV 2; validação conjunta da API | Android anterior aprovado pelo usuário; novo APK debug/cadastro pendentes |
| 5 | 10.6 e 7.1: fechar documentação e acesso | Ambos | Material corresponde ao comportamento real |
| 6 | 10.7, 8.1 e 8.2: release, vídeo e apresentação | Ambos | Versão identificada e reproduzível |

As tarefas 1A, 1B e 1C podem avançar em paralelo, sem sobrepor arquivos. Não
começar grandes funcionalidades novas antes de concluir esses critérios.

### 3. Retirada completa de LAN — tarefa 5.7

#### A. Cliente e empacotamento — DEV 2

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

#### B. Backend e contrato — DEV 1

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

#### C. Documentação e fechamento — ambos

Remover instruções de ativação LAN/firewall de README, roteiros, arquitetura e
orientações dos agentes. Distinguir o registro histórico de uma decisão antiga
do escopo vigente. Só concluir 5.7 quando a implementação e os testes passarem.

### 4. Dados para a avaliação — tarefa 10.1, DEV 1

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

### 5. Segurança e regras — tarefas 10.2 e 10.3, DEV 1

#### 10.2. Análise autorizada

Autenticar `/stock/analyze`, derivar o escopo da identidade verificada e impedir
consulta de outra fazenda mesmo quando `farmId` for forjado no body. Aplicar as
permissões documentadas dos perfis. Revisar o segredo JWT padrão no código: não
depender de um fallback público no ambiente publicado; alterações de configuração
externa exigem coordenação, não edição automática de envs.

**RED:** ausência/token inválido, fazenda alheia e perfis não autorizados.
**Aceite:** apenas consultas permitidas acessam dados da fazenda autenticada.

#### 10.3. Um caminho analítico efetivamente utilizado

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

### 6. Transparência para o usuário — tarefa 10.4

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

### 7. Regressão e aceite — tarefas 10.5 e 5.2

- Cliente: `npm test`, `npm run check` e `npm run build`.
- Nativo: `cargo test --locked --test storage` em `client/src-tauri/`.
- API: `npm test`, `npm run build` e `npm run test:sync` em infraestrutura
  PostgreSQL descartável disponível/autorizada. Mocks não comprovam locks reais.
- Exercitar perda de resposta após commit, retry com mesmo UUID, duas instalações,
  pendências criadas durante um envio, sessão expirada e restauração de backup.
- Validar a atualização sobre instalação existente, sem apagar SQLite, sessão,
  histórico ou fila. Nenhuma necessidade de editar a migration SQLite 001.
- Executar no Android real o roteiro `client/VALIDACAO_OFFLINE.md` e registrar
  evidências. **Aceite do APK anterior informado pelo usuário em 27/10; o novo
  APK debug e o novo cadastro ainda exigem teste próprio (5.8/10.5).**
- Retestar Windows e Android se a remoção de LAN afetar o novo build. A aprovação
  dos instaladores anteriores não comprova a aprovação da versão modificada.

Baseline observada antes deste roadmap: 201 testes API, 254 testes cliente e
5 testes Rust aprovados. Esses números não são evidência das correções futuras.

### 8. Documentação e entrega — tarefas 10.6 e 10.7, ambos

#### 10.6. Documentação verificável

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

#### 10.7. Release e apresentação

Congelar a versão depois das correções, publicar via PR para `dev`, integrar a
entrega com o fluxo existente para `main` e identificar o commit/tag avaliado.
Não sobrescrever a tag/release existente sem decisão explícita da equipe.

Gravar atualização → análise → justificativa → ação do gestor com a base do
desafio. Preparar vídeo e slides (8.1/8.2), ensaiar e conferir presença/equipamentos
(9.1–9.3). Confirmar submissão do GitHub na área da equipe e os prazos divulgados.
Não afirmar que o teste offline físico passou antes de executá-lo.

### 9. Limites de execução

Este roadmap inclui responsabilidades dos dois desenvolvedores; não é autorização
para um agente alterar a API durante uma tarefa restrita ao DEV 2. As partes
independentes do DEV 2 em **5.7-A** e **10.4** já foram concluídas; integrações
e aceite em aparelhos continuam sujeitos às pendências indicadas acima.

Toda mudança funcional segue RED executado pelo motivo correto → GREEN →
refatoração → regressões. Usar branches por tarefa, Conventional Commits e PR
para `dev`, preservando alterações locais existentes. Não editar envs, contrato
gerado à mão, migrations aplicadas ou bancos reais como efeito colateral.

Fora deste fechamento: LAN (cancelada, não backlog), cotas/reservas, cursor/CDC,
estornos e inventário físico, previsão avançada/sazonalidade, histórico completo
de preços e grandes refatorações. São decisões futuras independentes; não são
pré-requisitos automáticos do regulamento nem motivo para adiar as correções acima.
