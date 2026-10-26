# 📋 Plano de Tarefas e Execução — AgroHack 2026/2 (IFRO)

> **Desafio Oficial:** Gestão Inteligente de Insumos em uma Propriedade Rural  
> **Objetivo:** Transformar registros de estoque em informações úteis para identificar problemas, antecipar necessidades e apoiar decisões de forma simples e eficiente.  
> **Apresentação:** 29 de outubro de 2026 (Semana Nacional de Ciência e Tecnologia - SNCT)  
> **Premiação:** R$ 2.000,00  
> **Formação da Equipe:** 2 integrantes  

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
| **Sincronização Híbrida** | **Nuvem (HTTPS); LAN não implementada** | O app sincroniza **pela nuvem**. A rota Wi-Fi local (LAN) primeiro foi planejada e **não será implementada a tempo** (ver 5.6) |
| **Descoberta de IP** | **Não implementada** (heartbeat e mDNS planejados) | Os endpoints de IP local existem na API, mas nenhum aparelho publica o IP; depende do servidor LAN (5.6) |
| **Firewall do Windows** | **Script pronto, sem uso** | A regra da porta 3333 só serviria ao servidor LAN, não implementado (5.6); o instalador não a executa |
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
- [x] **2.4. [EM CONJUNTO / DEV 1] Alinhamento do Pacote Compartilhado:** Alinhar as fórmulas com o motor atual da API e unificar as regras agronômicas. Fórmulas de consumo por dias de calendário (janela de 30 dias UTC, incluindo dias sem retiradas), cálculo de autonomia, sobra por validade, detecção de anomalias (>= 3x da média anterior), estoque parado (>= 30 dias) e excesso (> 90 dias) 100% alinhadas entre backend e frontend, validadas via TDD (63 testes API e 98 testes Desktop aprovados).

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
  - [x] Registra o IP local do Nó Gestor na VPS para consulta do Operador. *Somente o endpoint na API: nenhum cliente o chama, pois a LAN não será implementada a tempo (ver 5.6).*

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

### ETAPA 4: Sincronização Híbrida, Backup e WhatsApp *(Dias 9 a 10 — EM PARALELO)*
*Diferenciais de peso para a banca avaliadora.*

#### 🔹 [DEV 1] Integração Twilio WhatsApp & Sync Backend
- [x] **4.1. Configuração da Conta Twilio:**
  - [x] Criar conta gratuita na Twilio e ativar a WhatsApp Sandbox.
  - [x] Configurar variáveis no Coolify (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`).
- [x] **4.2. Módulo de Disparo Automático:**
  - [x] Disparar mensagem WhatsApp para o número cadastrado do Gestor sempre que um alerta atingir nível CRÍTICO.
  - [x] Endpoint de teste manual para demonstração durante o pitch.

#### 🔹 [DEV 2] Sincronização no Cliente & Backup Estilo Anki
- [x] **4.3. Motor de Sincronização Híbrida:**
  - [x] Implementar outbox transacional, envio à API existente com `openapi-fetch`, reenvios por UUID, proteção de pendências e download completo enquanto o backend não oferece cursor seguro.
  - [x] Validar convergência de dois SQLite locais e perda de resposta após gravação em servidor simulado, sem duplicidade de movimentações.
  - [x] Endpoints de IP local da fazenda (`POST /devices/local-ip`) e inclusão do IP nos payloads de pareamento, **somente no lado da API**: nenhum aparelho publica o IP, então ele sempre chega vazio (ver 5.6).
  - [x] Transporte híbrido no cliente (`createHybridTransport`) com fallback transparente para a nuvem (VPS Coolify), testado: sem IP local, ou se a LAN falhar, o app sincroniza pela nuvem.
  - [ ] Caminho LAN do transporte (ping rápido no gestor e sincronização sem internet): depende do servidor LAN do gestor, que **não será implementado a tempo** (ver 5.6).
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

- [ ] **4.8. [EM CONJUNTO] Alertas de emergência via WhatsApp: validação ponta a ponta, interface do gestor e segurança:**
  > Auditoria de 26/10: as tarefas 4.1, 4.2 e 6.2 entregaram o backend (envio pela Twilio com modo simulação; após um `/sync` que aceita movimentações, a reanálise grava o alerta e avisa o gestor dos alertas urgentes ainda não notificados). Faltavam a interface do gestor (a branch `feat/whatsapp-manager-ui` nunca foi mergeada), a proteção dos endpoints e a validação real.
  - [x] Auditar o que existe e o que falta (backend `NotificationsService`, `StockService.reanalyzeAndPersistAlerts`, gatilho em `SyncService`).
  - [x] Segurança: `POST /notifications/test-whatsapp` e `POST /notifications/dispatch-critical` exigem o JWT de um gestor; o teste só vai ao WhatsApp cadastrado do gestor da própria fazenda e o disparo só vale para a fazenda da identidade (`api/src/notifications/*.spec.ts`, 28 testes).
  - [x] Interface do gestor: painel *"Alertas de emergência via WhatsApp"* na Visão geral (status Ativo/Não configurado e *Testar envio de alerta*), com a sessão trazendo o `telefone` (login, cadastro e SQLite local). O teste distingue envio real, **modo de simulação** (servidor sem Twilio configurada, nada é enviado) e falha com o motivo; a API responde HTTP 200 mesmo quando a Twilio recusa (`client/tests/whatsapp-alerts*.spec.ts`).
  - [x] Número do gestor: o gestor cadastra, troca ou desativa o WhatsApp depois do registro (`PATCH /auth/telefone` e campo no painel). O número é normalizado para `+<dígitos>` no cadastro, na edição e no envio; antes um número digitado como `+55 69 99999-9999` chegava inválido à Twilio. **O gestor do seed continua com o número fictício `+5569999999999` até ser trocado pelo painel.**
  - [ ] Validar em produção: `TWILIO_*` no Coolify (log *"Twilio WhatsApp Client inicializado"*), número do gestor dentro do Sandbox da Twilio e recebimento real de uma mensagem.
  - [ ] Roteiro da demonstração: usar um insumo que ainda não tenha alerta. O alerta é gravado uma vez por produto e tipo e não se resolve sozinho, então um novo lançamento no mesmo insumo não reenvia a mensagem.
  - [ ] Documentar no README os pré-requisitos (Sandbox da Twilio) e os limites (um aviso por alerta, só nível urgente).

---

### ETAPA 5: Empacotamento do .exe e .apk *(Dia 11)*
*Geração dos artefatos finais para entrega.*

- [ ] **5.1. [DEV 2] Build do Desktop (.exe) com Regra de Firewall:**
  - [x] Configurar pipeline de compilação Windows no GitHub Actions (`.github/workflows/build-release.yml`) restrito à branch `main` e tags `v*`.
  - [x] Embutir script pós-instalação para liberar porta TCP local no Firewall do Windows (`client/scripts/liberar-firewall.bat`):
    `netsh advfirewall firewall add rule name="AgroHack Local Server" dir=in action=allow protocol=TCP localport=3333 profile=private`
    > O script existe, mas o instalador não o executa, e a porta 3333 só seria usada pelo servidor LAN, que não será implementado a tempo (ver 5.6).
  - [x] Build Windows executado no GitHub Actions na `main` (26/10): `.exe` e `.msi` publicados na release `v1.0.0-entrega`, substituindo os de 21/10 (que apontavam para `localhost`).
  - [x] `.exe` da release instalado no PC de desenvolvimento (26/10): abre e sincroniza com a nuvem.
  - [ ] Testar instalação limpa em máquina Windows sem versão anterior instalada.
- [ ] **5.2. [DEV 2] Build do Mobile (.apk):**
  - [x] Configurar pipeline de compilação Android (.apk) no GitHub Actions (`.github/workflows/build-release.yml`) com Java, Android SDK, NDK e targets Rust.
  - [x] APK debug instalado em celular Android real (26/10): abre, login com as contas do seed funcionando contra a API.
  - [ ] Testar o funcionamento offline em celular Android real (modo avião, movimentação e sincronização ao reconectar).
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
- [ ] **5.6. [EM CONJUNTO] Servidor LAN mínimo no gestor (relay, conforme `regra_de_sync.md` §12) — NÃO SERÁ IMPLEMENTADO A TEMPO (decisão de 26/10; fora do escopo do MVP):**
  > Decisão: a sincronização por rede local (LAN) **não será entregue na apresentação de 29/10**. O app sincroniza **somente pela nuvem**; sem internet, os registros ficam salvos no SQLite do aparelho e são enviados ao reconectar, sem duplicidade. As subtarefas abaixo ficam como **backlog para uma versão futura**.
  >
  > Premissas do desenho: o gestor **recebe de forma durável e encaminha à nuvem**; um recibo LAN não equivale a `ACCEPTED` da nuvem e o operador mantém sua cópia até a confirmação da nuvem; os IDs e as credenciais originais do operador são preservados (proveniência verificável, idempotência independente da rota). Servidor só no gestor **desktop**. O tráfego LAN é HTTP sem TLS: limitação a documentar.
  - [ ] Servidor HTTP no gestor (Rust/Tauri) em `0.0.0.0:3333` com `GET /health` e `POST /sync`; recebimento durável em SQLite (nova migration local, sem editar a 001); recibo `LAN_RECEIVED` distinto de `ACCEPTED`.
  - [ ] Encaminhamento do gestor para a nuvem preservando credenciais e IDs do operador, de forma idempotente.
  - [ ] Cliente do operador: estado *recebido pelo gestor* na outbox, mantendo a cópia até a confirmação da nuvem (nova migration local).
  - [ ] Descobrir e publicar o IP local do gestor (`POST /devices/local-ip`) e incluí-lo no QR de pareamento.
  - [ ] Android: permitir HTTP em texto claro para a LAN (patch no manifest gerado pelo CI) e validar que o WebView alcança o gestor.
  - [ ] Windows: ligar a regra de firewall da porta 3333 ao instalador (hoje `client/scripts/liberar-firewall.bat` existe, mas não é executado pelo instalador).
  - [ ] Teste ponta a ponta: celular e PC na mesma Wi-Fi sem internet, sincronização por LAN e depois pela nuvem, sem duplicidade.

---

### ETAPA 6: Carga da Base Oficial, Testes e Limitações *(Dias 11 a 12)*
*Critério de 15 pontos da banca avaliadora.*

- [x] **6.1. [DEV 1] Carga da Base de Dados Oficial do AgroHack:**
  - [x] Importar os dados oficiais disponibilizados pela organização para a VPS e para os bancos locais (dataset oficial em `api/src/stock/official-seed.data.ts` cobrindo as 7 categorias obrigatórias, 2 operadores rápidos `AGRO-01`/`AGRO-02`, e os 4 cenários agronômicos: falta em 3 dias da Ureia, risco de vencimento do Trichoderma, anomalia de 950L no Diesel S10 e imobilização de R$ 147k no Adubo MAP).
  - [x] Validação automatizada via TDD (`api/src/stock/official-seed.spec.ts`) e integração com `api/prisma/seed.ts` e comando `npm run seed`.
- [x] **6.2. [DEV 2] Validação da Reanálise em Tempo Real:**
  - [x] Registrar uma saída que deixe um insumo crítico e comprovar o recálculo imediato do alerta na tela e o disparo no WhatsApp (implementado `reanalyzeAndPersistAlerts` com persistência na tabela `Alert`, disparo pelo `NotificationsService` e recálculo no cliente via `refresh` -> `analyzeInventory`, testado em `stock.service.spec.ts` e `realtime-reanalysis-offline.spec.ts`).
- [x] **6.3. [EM CONJUNTO] Validação do Modo Offline:**
  - [x] Validar automaticamente persistência offline, rollback e reenvio idempotente entre dois SQLite e um servidor simulado.
  - [x] Desligar Wi-Fi/4G (modo avião), fazer movimentações no cliente, reconectar e confirmar a sincronização sem duplicidade com UUIDs preservados e liquidação atômica de pendências (`client/tests/realtime-reanalysis-offline.spec.ts`).

- [x] **6.4. [EM CONJUNTO] Registro de Limitações:**
  - [x] Documentar arquitetura do cliente, critérios locais, execução, testes e limites de integração em `client/README.md`.
  - [x] Mapear o que a solução faz com excelência e documentar limitações conhecidas de forma transparente.
  - [x] Registrar que a sincronização por LAN não será implementada a tempo (README §7.2, `client/README.md`, `regra_de_sync.md` §12 e roteiros do vídeo), mantendo a nuvem como único caminho de sincronização.

---

### ETAPA 7: Documentação Obrigatória (README Anexo II) *(Dia 12)*
*Critério rigoroso do regulamento do IFRO.*

- [x] **7.1. [EM CONJUNTO] Redação do README.md oficial com os 10 tópicos obrigatórios:**
  - [x] 1. Equipe (nomes dos 2 integrantes, cursos, papéis e responsável ADS).
  - [x] 2. Problema e público (contexto rural, Gestores e Operadores).
  - [x] 3. Solução (arquitetura híbrida, Central Dinâmica e paridade Desktop/Mobile).
  - [x] 4. Como testar (instruções reproduzíveis e links para download do `.exe` e `.apk`).
  - [x] 5. Dados e critérios (campos tratados, regras de runout, Curva ABC e anomalias).
  - [x] 6. Demonstração (link do vídeo gravado, prints e evidências de reanálise).
  - [x] 7. Validação e testes (resultados observados e limitações da solução).
  - [x] 8. Tecnologias e declaração de IA (lista de ferramentas e declaração formal do uso de IA).
  - [x] 9. Autoria e licença (termos de uso e garantia de nenhuma credencial/token exposto).
  - [x] 10. Versão de entrega (tag `v1.0.0-entrega` e hash do commit).

---

### ETAPA 8: Vídeo Demonstrativo e Preparação do Pitch *(Dia 13 — Pré-Apresentação)*
*Entregáveis para a banca antes do dia 29/10.*

- [ ] **8.1. [EM CONJUNTO] Gravação do Vídeo Demonstrativo (3 a 5 min):**
  - [ ] Roteiro:
    1. Abertura: Dores do produtor rural (falta inesperada e dinheiro parado).
    2. Demonstração do Painel do Gestor com alertas críticos e Curva ABC.
    3. Pareamento rápido do Operador via QR Code e via Código Alfanumérico.
    4. Operador lançando saída no celular em modo 100% offline.
    5. Sincronização automática e reanálise instantânea dos alertas na tela.
    6. Recebimento do alerta urgente no WhatsApp via Twilio.
    7. Demonstração do backup automático e restauração em 1 clique (estilo Anki).
  - [ ] Upload no YouTube (não listado) e inclusão do link no `README.md`.
- [ ] **8.2. [EM CONJUNTO] Produção dos Slides do Pitch:**
  - [ ] Apresentação visual focada em: Problema -> Solução Híbrida -> Demonstração Prática -> Impacto no Bolso do Produtor -> Limitações.
  - [ ] Salvar versão final em PDF no repositório.

---

### ETAPA 9: Apresentação Final na SNCT *(29/10/2026)*
*O grande dia no IFRO Campus Ariquemes.*

- [ ] **9.1. [EM CONJUNTO] Ensaio do Pitch:** Cronometrar o tempo de fala e divisão entre os 2 integrantes.
- [ ] **9.2. [EM CONJUNTO] Alinhamento para a Sabatina:** Preparar respostas sobre regras do negócio rural, consistência offline e uso ético de IA.
- [ ] **9.3. [EM CONJUNTO] Checklist Presencial:** Notebooks carregados, `.exe` rodando offline, celular com a `.apk` instalada e presença confirmada.
