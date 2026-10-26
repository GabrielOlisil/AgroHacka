# 🌾 AgroHacka — Gestão Inteligente de Insumos Rurais

> **Solução Oficial da Equipe Oliveira & Oliveira para o AGROHACK 2026/2 — IFRO Campus Ariquemes**  
> *Transformando registros de estoque rural em informações estratégicas para antecipar necessidades, evitar prejuízos e apoiar decisões com arquitetura 100% Offline-First.*

---

## 📑 Sumário Oficial (Conforme Anexo II do Regulamento)

1. [Equipe](#1-equipe)
2. [Problema e Público](#2-problema-e-público)
3. [Solução e Arquitetura](#3-solução-e-arquitetura)
4. [Como Testar e Executar](#4-como-testar-e-executar)
5. [Dados e Critérios Agronômicos](#5-dados-e-critérios-agronômicos)
6. [Demonstração e Casos de Uso](#6-demonstração-e-casos-de-uso)
7. [Validação, Testes Automatizados e Limitações](#7-validação-testes-automatizados-e-limitações)
8. [Tecnologias Utilizadas e Declaração de IA](#8-tecnologias-utilizadas-e-declaração-de-ia)
9. [Autoria, Licença e Segurança](#9-autoria-licença-e-segurança)
10. [Versão de Entrega e Rastreabilidade](#10-versão-de-entrega-e-rastreabilidade)

---

## 1. Equipe

| Informação | Detalhe Oficial |
| :--- | :--- |
| **Nome da Equipe** | **Oliveira & Oliveira** |
| **Protocolo de Inscrição** | `AGRO26-F009CD2F9F` |
| **Instituição** | Instituto Federal de Rondônia (IFRO) — Campus Ariquemes |
| **Integrante 1 (DEV 1)** | **Kauê Rian Silva Conceição Oliveira** — ADS 6º Período (Foco: Backend, Dados, Sincronização e Infraestrutura) |
| **Integrante 2 (DEV 2)** | **Gabriel de Oliveira Silva** — ADS 6º Período (Foco: Frontend, Tauri v2, SQLite Offline e UX) |

---

## 2. Problema e Público

### 2.1. O Contexto do Agronegócio Rural
Em uma propriedade rural produtiva, dezenas de insumos circulam continuamente: fertilizantes (NPK, Ureia, MAP), corretivos (calcário dolomítico), sementes híbridas, defensivos químicos e biológicos, combustíveis (diesel S10), lubrificantes, filtros, tubos de irrigação e EPIs. 

Apesar de cadastrarem entradas e saídas, os produtores rurais enfrentam gargalos críticos:
1. **Falta Inesperada:** Insumos essenciais acabam em momentos cruciais de plantio ou colheita, paralisando tratores e equipes.
2. **Prejuízo com Vencimento:** Produtos nobres e caros (como biológicos e defensivos) vencem no barracão antes de serem utilizados por falta de controle de ritmo de uso.
3. **Anomalias Invisíveis:** Desvios ou vazamentos em tanques de combustível passam desapercebidos em meio a centenas de anotações manuais.
4. **Capital Parado:** Milhares de reais imobilizados em adubos e peças sem giro, gerando custo de oportunidade financeiro.
5. **Conectividade Precária:** A maioria dos talhões e barracões não possui sinal de internet (Wi-Fi ou 4G/5G). Sistemas web comuns travam ou impedem lançamentos no momento do fato gerador.

### 2.2. Público-Alvo e Apoio à Decisão
- **O Produtor / Gestor Rural:** Precisa de visão panorâmica imediata (quais alertas exigem ação urgente hoje, qual é o valor financeiro do estoque, o que está para vencer e onde o dinheiro está imobilizado).
- **O Operador de Campo (Tratoristas, Almoxarifes, Campeiros):** Precisa de agilidade máxima: registrar uma baixa de insumo ou entrada de compra com 2 toques no celular, mesmo sem nenhuma conexão à internet, sem burocracia e com autoria rastreável.

---

## 3. Solução e Arquitetura

O **AgroHacka** é uma plataforma híbrida **Offline-First**, estruturada para garantir operação contínua no campo e consolidação confiável em nuvem.

### 3.1. Arquitetura do Ecossistema

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    VPS Central (Coolify)                    │
 │  ┌───────────────────────────┐ ┌──────────────────────────┐ │
 │  │      NestJS REST API      │ │    PostgreSQL 16 +       │ │
 │  │ (JWT, Sincronização, Sync) │ │    Prisma ORM            │ │
 │  └─────────────┬─────────────┘ └────────────┬─────────────┘ │
 └────────────────┼────────────────────────────┼───────────────┘
                  │ HTTPS / Protocol v2        │
                  ▼                            │
 ┌─────────────────────────────────────────────────────────────┐
 │           Clientes Híbridos (Tauri v2 + Vue 3)              │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │   Central Dinâmica (Nó Gestor ou Nó Operador)         │  │
 │  │   - Interface Desktop (.exe Windows) & Mobile (.apk)  │  │
 │  │   - SQLite Local Nativo (@tauri-apps/plugin-sql)      │  │
 │  │   - Motor de Inteligência de Estoque Local (TS Puro)  │  │
 │  │   - Snapshots de Backup Atômico Diário (Estilo Anki)  │  │
 │  │   - Pareamento Flexível: QR Code + Código Alfanumérico│  │
 │  └───────────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────┘
```

### 3.2. Destaques da Implementação
- **Central Dinâmica:** Qualquer dispositivo pode assumir o papel de **Gestor** (mediante e-mail e senha, com sessão offline persistente no SQLite) ou **Operador** (mediante pareamento por QR Code ou código alfanumérico de 6 caracteres gerado pelo Gestor).
- **100% Offline-First:** Toda baixa ou entrada é gravada atomicamente no SQLite local, recalculando os alertas e a Curva ABC instantaneamente na tela do dispositivo, sem esperar rede.
- **Protocolo de Sincronização Confiável (v2):** Outbox transacional com UUIDs imutáveis, recibos individuais auditáveis, idempotência e tratamento explícito de divergências de saldo sem descartar fatos físicos.
- **Backup Automático Estilo Anki:** Snapshots atômicos locais via `VACUUM INTO`, retenção automática de 7 dias e restauração garantida em 1 clique.
- **Alertas WhatsApp (Twilio API):** Notificações automáticas para o WhatsApp do Gestor quando uma sincronização gera um alerta de nível urgente. O Gestor cadastra, troca ou desativa o número e testa o envio no painel *Alertas de emergência via WhatsApp* (pré-requisitos e limites na seção 4.4).

---

## 4. Como Testar e Executar

### 4.1. Requisitos de Ambiente
- **Node.js:** versão 22 ou 24 LTS
- **Rust e Tauri CLI:** para execução nativa dos clientes (opcional para testes de lógica)
- **Docker:** (opcional, para testes de concorrência com PostgreSQL temporário)

### 4.2. Executando o Backend (API NestJS)

```bash
# 1. Acesse o diretório da API
cd AgroHacka/api

# 2. Instale as dependências
npm install

# 3. Gere o Prisma Client
npx prisma generate

# 4. Execute a suíte de testes unitários e de integração
npm test

# 5. Opcional: Execute o seed da base simulada do AgroHack
npx tsx prisma/seed.ts

# 6. Inicie o servidor em modo de desenvolvimento
npm run start:dev
```
A API estará acessível em `http://localhost:3000` (documentação Swagger em `http://localhost:3000/api/docs`).

### 4.3. Executando o Cliente (Desktop / Mobile - Vue 3 + Tauri)

```bash
# 1. Acesse o diretório client
cd AgroHacka/client

# 2. Instale as dependências
npm install

# 3. Execute todos os testes unitários, testes de banco SQLite nativo e migrações
npm test

# 4. Verifique a integridade de tipos TypeScript
npm run check

# 5. Execute a compilação de produção
npm run build

# 6. Modo de Desenvolvimento com Interface Web (Revisão Rápida)
npm run dev
# Acesse no navegador: http://localhost:5173/tests/visual-preview.html
# Parâmetros de teste visual:
# - Gestor: http://localhost:5173/tests/visual-preview.html
# - Operador: http://localhost:5173/tests/visual-preview.html?profile=operador
# - Boas-vindas (Novo Usuário): http://localhost:5173/tests/visual-preview.html?profile=guest

# 7. Execução do Aplicativo Nativo com Tauri v2
npm run tauri:dev
```

### 4.4. Alertas de Emergência via WhatsApp (Twilio)

O servidor envia um WhatsApp ao Gestor quando uma sincronização cria um alerta **urgente** (estoque crítico, insumo vencido).

**Pré-requisitos**
1. **Variáveis de ambiente no servidor (as três obrigatórias para envio real):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_PHONE`. `TWILIO_PHONE` é o número remetente mostrado no Console da Twilio em *Messaging → Try out WhatsApp*: contas novas recebem um número próprio (por exemplo, `+17372508034`), e o antigo Sandbox compartilhado `+1 415 523 8886` não vale para elas. Se faltar qualquer variável, a API roda em **modo de simulação** e nada é enviado; o botão *Testar envio de alerta* do app avisa quando isso acontece.
2. **Conectar o celular do Gestor:** em *Try out WhatsApp*, selecione o número de teste verificado e envie, desse WhatsApp, o código exibido (por exemplo, `join twilio-trial`) para o número remetente. Só um número de teste fica ativo por vez, e o plano gratuito tem 100 mensagens. Se as mensagens pararem de chegar, envie o código de novo antes de gravar o vídeo e antes da apresentação.
3. **Celulares do Brasil e o nono dígito:** muitas contas do WhatsApp brasileiras são identificadas **sem o 9 depois do DDD** (`+55 69 9XXXX-XXXX` vira `+55 69 XXXX-XXXX`). O número de teste verificado na Twilio e o número salvo no app precisam estar **no mesmo formato** com que o WhatsApp identifica o celular; com o formato errado, o `join` não é reconhecido e a mensagem não chega. Confirmado na configuração de 26/10.
4. **Número do Gestor** em formato internacional, informado no cadastro ou em *Visão geral → Alertas de emergência via WhatsApp*. Aceita espaços e hífens; em branco desativa os alertas. O Gestor do seed usa um número fictício e precisa ser trocado.
5. **Conta trial só aceita modelos prontos:** no *Try out WhatsApp* a Twilio recusa texto livre (erro `ContentSid Required`). Defina `TWILIO_CONTENT_SID` (e, se o modelo tiver variáveis, `TWILIO_CONTENT_VARIABLES` em JSON) com os valores do trecho de código da página. Nesse modo o WhatsApp chega com o **texto do modelo da Twilio**, e o alerta completo (insumo, nível, diagnóstico) fica no app. Sem essas variáveis, a API envia o texto formatado do alerta, o que funciona no Sandbox clássico ou em conta paga.

**Como funciona e limites**
- O disparo acontece depois de um `/sync` que aceita movimentações: a API reanalisa o estoque, grava os alertas e avisa os urgentes ainda não notificados.
- **Um aviso por alerta.** O alerta é gravado uma vez por insumo e tipo enquanto não for resolvido, e a versão atual não resolve alertas sozinha. Um novo lançamento no mesmo insumo **não reenvia** a mensagem.
- Somente o nível **urgente** gera WhatsApp; atenção e informativo aparecem só no app. Na base oficial, a *Ureia* (falta em ~3 dias) é o cenário de falta crítica; outros insumos podem ficar urgentes conforme os lançamentos.
- Os endpoints `POST /notifications/test-whatsapp` e `POST /notifications/dispatch-critical` exigem o JWT do Gestor.

**Para repetir a demonstração:** marque como resolvidos os alertas da fazenda, sem apagar o histórico. A próxima sincronização os recria e notifica de novo.

```sql
UPDATE alerts SET resolvido = true WHERE "farmId" = '<id da fazenda>';
```

---

## 5. Dados e Critérios Agronômicos

O motor analítico do AgroHacka responde diretamente às **7 perguntas oficiais** do desafio, implementado com estrita paridade matemática entre o backend (`api/src/stock-engine`) e o SQLite local (`client/src/offline/analysis.ts`).

### 5.1. Critérios de Cálculo e Fórmulas

| Pergunta Oficial do AgroHack | Regra / Critério de Análise Agronômica | Justificativa Gerada |
| :--- | :--- | :--- |
| **1. O que está acabando e precisa ser comprado?** | **Cálculo de Runout Time em Dias de Calendário:**<br>Analisa janela móvel de 30 dias de calendário UTC. Dias amostrados = `today - firstDay + 1` (inclui dias sem retirada). Taxa diária = $\frac{\sum \text{quantidades}}{\text{dias}}$. Autonomia = $\frac{\text{Saldo}}{\text{Taxa}}$. | *“Mantendo o consumo médio de 5.0 sc/dia (últimos 10 dias), o saldo atual será suficiente por ~3 dias.”* |
| **2. Quais produtos podem vencer antes do uso?** | **Risco de Vencimento vs. Ritmo de Consumo:**<br>Compara os dias até o vencimento ($\Delta t$) com a autonomia. Calcula a sobra estimada: $\text{Sobra} = \text{Saldo} - (\Delta t \times \text{Taxa Diária})$. Se $\text{Sobra} > 0$ e $\Delta t \le 30$ dias, dispara alerta. | *“Atenção: cerca de 38 unidades irão vencer antes de serem utilizadas (vencimento em 12 dias).”* |
| **3. Quanto está sendo consumido de cada produto?** | **Histograma de Consumo Diário:**<br>Mapeamento de saídas por dia de calendário na janela de 30 dias, permitindo visualizar sazonalidade e picos. | Gráfico de barras com histórico diário exibido no painel de cada insumo. |
| **4. Existem consumos fora do padrão?** | **Detecção Estatística de Anomalias:**<br>Exige histórico mínimo de 3 retiradas. Compara a retirada atual com a média das retiradas anteriores. Se $\ge 3\times$ a média, classifica como anomalia grave. | *“Retirada atípica: 950 L é 15.8x superior à média recente (60 L). Critério: pelo menos 3x a média.”* |
| **5. Por quanto tempo o estoque será suficiente?** | **Autonomia Projetada com Nível de Confiança:**<br>Classifica a confiabilidade da estimativa em ALTA ($\ge 5$ retiradas), MÉDIA ($\ge 3$ retiradas) ou BAIXA ($< 3$ retiradas ou sem saídas). | Transparência no cartão do produto sobre a confiabilidade estatística do cálculo. |
| **6. Quais produtos representam maior valor financeiro?** | **Curva ABC & Estoque Parado:**<br>- Classe A: até 80% do capital acumulado.<br>- Classe B: 80% a 95% do capital.<br>- Classe C: 95% a 100% do capital.<br>- **Estoque Parado:** Saldo positivo sem nenhuma saída há $\ge 30$ dias.<br>- **Excesso de Estoque:** Autonomia $> 90$ dias. | *“Saldo positivo sem saídas há pelo menos 30 dias. Verifique a necessidade de novas compras.”* |
| **7. Quais itens merecem atenção imediata?** | **Priorização Tripla de Alertas:**<br>1. **URGENTE:** Estoque zerado, saldo $\le$ mínimo, autonomia $\le 7$ dias ou produto já vencido.<br>2. **ATENÇÃO:** Autonomia entre 8 e 15 dias, sobra antes da validade em até 30 dias ou anomalia de consumo.<br>3. **INFORMATIVO:** Estoque parado há 30 dias ou excesso acima de 90 dias. | Ordenação decrescente de severidade na tela principal do Gestor e acionamento do Twilio. |

---

## 6. Demonstração e Casos de Uso

### 6.1. Roteiro Demonstrativo do Sistema
1. **Abertura:** O Gestor visualiza no Dashboard os cartões com contagem de alertas críticos e capital imobilizado.
2. **Identificação de Problema Crítico:** O insumo *Ureia* acusa autonomia crítica para menos de 3 dias no ritmo atual.
3. **Pareamento em 10 Segundos:** O Gestor cadastra o operador *Carlos Silva (Tratorista)* e gera um QR Code com código alfanumérico alternativo `AGRO-01`.
4. **Operação no Campo 100% Offline:** Em modo avião, o operador dá baixa de 60 litros de Diesel S10. O saldo local é decrementado imediatamente e o histórico é gravado.
5. **Detecção de Anomalia:** Um lançamento atípico de 950 litros de Diesel gera imediatamente um alerta de desvio estatístico.
6. **Convergência e Sincronização:** Ao restabelecer conexão (ou via botão *Sincronizar*), as transações locais sobem para a VPS sem duplicidade e recebem recibos individuais confirmados.
7. **Disparo no WhatsApp:** O alerta urgente é enviado via Twilio para o smartphone do Gestor (pré-requisitos e como reiniciar os alertas na seção 4.4).
8. **Segurança de Dados:** Demonstração do backup automático no SQLite com restauração atômica em 1 clique.

---

## 7. Validação, Testes Automatizados e Limitações

### 7.1. Validação por Testes Automatizados (TDD)
O projeto foi desenvolvido sob a disciplina rigorosa do **Desenvolvimento Orientado a Testes (TDD)**:
- **API NestJS:** 174 testes unitários e de integração aprovados com Vitest, mais 19 de concorrência contra PostgreSQL descartável (`npm run test:sync`) ([`stock-engine.spec.ts`](api/src/stock-engine/stock-engine.spec.ts), [`sync.service.spec.ts`](api/src/sync/sync.service.spec.ts), [`auth.service.spec.ts`](api/src/auth/auth.service.spec.ts), etc.).
- **Desktop/Mobile (Tauri + Vue):** 254 testes aprovados com Vitest e SQLite real via `node:sqlite` ([`local-store.spec.ts`](client/tests/local-store.spec.ts), [`analysis.spec.ts`](client/tests/analysis.spec.ts), [`migrations.spec.ts`](client/tests/migrations.spec.ts), [`sync.spec.ts`](client/tests/sync.spec.ts), etc.).
- **Validação de Tipos e Build:** `vue-tsc -b` e `vite build` sem warnings ou erros de tipagem.

### 7.2. Registro Transparente de Limitações
Em conformidade com as diretrizes acadêmicas do IFRO, documentamos com clareza os limites da versão atual:
1. **Catálogo de Produtos Centralizado:** O cadastro de novos produtos deve ser realizado na interface do Gestor ou disponibilizado pelo backend; operadores em campo registram movimentações sobre o catálogo sincronizado, não criando novos SKUs offline.
2. **Proteção por Cofre Nativo do SO:** Tokens JWT e backups locais SQLite residem em arquivos do usuário; a criptografia em repouso por cofre nativo (Windows DPAPI / Android Keystore) está mapeada para a próxima versão de produção.
3. **Sincronização por Download Completo:** Enquanto um cursor seguro de CDC (Change Data Capture) não for disponibilizado na API, o cliente baixa o catálogo consistente integral e mescla por UUID, mitigando riscos de janelas temporais cegas.
4. **Câmera em Dispositivos Físicos:** A leitura do QR Code pela câmera foi validada em aparelho Android real (Motorola g75 5G, Android 16): ao ler o QR, o aparelho conecta sozinho. Se a permissão for negada ou não houver câmera, o app orienta usar uma imagem do QR ou o código alfanumérico manual, alternativa de alta resiliência para qualquer situação sem câmera. Outros modelos de aparelho não foram testados.
5. **Sincronização por Rede Local (LAN) não implementada:** a sincronização direta entre aparelhos na mesma Wi-Fi, sem internet, **não será implementada a tempo para a apresentação**. Todos os aparelhos sincronizam **pela nuvem (HTTPS)**; sem internet, os lançamentos ficam salvos no SQLite do aparelho e são enviados ao reconectar, sem duplicidade (UUIDs idempotentes). A API já possui os endpoints de IP local e heartbeat, mas o servidor no aparelho do gestor, a descoberta de IP e o encaminhamento LAN → nuvem não existem; por isso nenhum IP local é publicado e o app usa sempre a nuvem. O desenho previsto está em [`regra_de_sync.md`](regra_de_sync.md) §12.

---

## 8. Tecnologias Utilizadas e Declaração de IA

### 8.1. Tecnologias Empregadas
- **Linguagens:** TypeScript 5.8+, Rust 1.80+ (Tauri v2), SQL (PostgreSQL e SQLite).
- **Frontend / Clientes:** Vue 3, Vite, Tauri v2, Tailwind-free Vanilla Design System com tokens próprios, ícones Lucide, `@zxing/browser` (QR Code) e `@fontsource/inter`.
- **Backend:** NestJS 12, Prisma ORM 6, Express, bcrypt, jsonwebtoken.
- **Bancos de Dados:** SQLite 3 (local nos clientes) e PostgreSQL 16 (nuvem VPS).
- **Comunicação e Notificações:** Twilio WhatsApp API (ambiente de testes *Try out WhatsApp*).
- **Infraestrutura:** VPS própria orquestrada via Coolify e Docker.

### 8.2. Declaração Formal de Uso Ético de Inteligência Artificial
Em cumprimento ao item 8 do Anexo II do regulamento do AGROHACK 2026/2, a equipe declara:
> *“Ferramentas de Inteligência Artificial Generativa (Claude 3.7 Sonnet e Gemini via Antigravity IDE) foram utilizadas como assistentes de codificação em pair-programming, auxiliando na geração de scaffolding, revisão de tipagens estritas TypeScript, criação de baterias de testes unitários TDD e elaboração de documentação técnica. Toda a lógica de negócio agronômica, modelagem relacional, arquitetura de sincronização idempotente e regras de decisão foram concebidas, revisadas, testadas e validadas integralmente pelos integrantes da equipe.”*

---

## 9. Autoria, Licença e Segurança

- **Autoria:** Gabriel de Oliveira Silva e Kauê Rian Silva Conceição Oliveira.
- **Licença:** Distribuído sob a licença open-source MIT.
- **Segurança de Credenciais:** Nenhuma chave privada, credencial de produção, token Twilio ou senha pessoal está exposta no repositório. Variáveis de ambiente sensíveis são gerenciadas exclusivamente através dos painéis protegidos do Coolify na VPS e em arquivos locais `.env` ignorados pelo `.gitignore`.

---

## 10. Versão de Entrega e Rastreabilidade

- **Versão:** `v1.0.0-entrega`
- **Repositório Oficial:** [https://github.com/GabrielOlisil/AgroHacka](https://github.com/GabrielOlisil/AgroHacka)
- **Branch de Desenvolvimento:** `dev`
- **Branch de Produção / Entrega:** `main`
- **Data da Apresentação:** 29 de outubro de 2026 — Semana Nacional de Ciência e Tecnologia (SNCT) no IFRO Campus Ariquemes.
