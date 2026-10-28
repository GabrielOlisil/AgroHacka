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
| **Responsável ADS** | **Gabriel de Oliveira Silva** |

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
- **Estoque do Gestor:** Cadastro online de insumos com categoria/unidade livres, filtros e ações de entrada/saída na própria aba Estoque. Novos insumos chegam aos operadores pelo sync; o saldo vem das movimentações.
- **Gestão de Operadores:** O gestor edita nomes, ativa/desativa acesso e exclui operadores da própria fazenda, com confirmação. Movimentações preservam somente o nome histórico do responsável, sem FK ao operador. O aplicativo Desktop/Android fica exclusivamente em `client/`.
- **Protocolo de Sincronização Confiável (v2):** Outbox transacional com UUIDs imutáveis, recibos individuais auditáveis, idempotência e tratamento explícito de divergências de saldo sem descartar fatos físicos.
- **Backup Automático Estilo Anki:** Snapshots atômicos locais via `VACUUM INTO`, retenção automática de 7 dias e restauração garantida em 1 clique.
- **Alertas WhatsApp (Twilio API):** Notificações automáticas para o WhatsApp do Gestor quando uma sincronização gera um alerta de nível urgente. O Gestor cadastra, troca ou desativa o número e testa o envio no painel *Alertas de emergência via WhatsApp* (pré-requisitos e limites na seção 4.4).

---

## 4. Como Testar e Executar

**Instalar sem compilar:** baixe o instalador Windows (`.exe` ou `.msi`), o executável Windows sem instalador (`app-portable.exe`), o APK Android (debug) ou o Linux `.AppImage` em [Releases → versão oficial mais recente](https://github.com/GabrielOlisil/AgroHacka/releases/latest). Os apps já apontam para a API publicada: crie uma conta de gestor na tela inicial e conecte operadores pelo QR Code ou código. Para rodar tudo localmente com a base simulada, siga as seções 4.2 e 4.3.

A compilação Android permanece em **debug**, com assinatura automática de
desenvolvimento, sem exigir chave release ou secrets Android. A publicação dos
pacotes depende da conclusão dos três builds no GitHub Actions (Windows, Android e Linux).

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

# 5. Opcional: carregue a fazenda de demonstração (dados simulados, não destrutiva; ver seção 5.2)
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
- **Um aviso por alerta.** O alerta é gravado uma vez por insumo e tipo enquanto estiver aberto, e um novo lançamento com a mesma situação **não reenvia** a mensagem.
- **Ciclo automático:** a cada reanálise, o alerta cuja situação deixou de existir é marcado como resolvido (o histórico fica). Se a situação voltar, um novo alerta é gravado e notificado. Um alerta que sobe de atenção para urgente é atualizado e passa a ser notificado.
- Somente o nível **urgente** gera WhatsApp; atenção e informativo aparecem só no app. Na base simulada, a *Ureia* (falta em ~3 dias) é o cenário de falta crítica; outros insumos podem ficar urgentes conforme os lançamentos.
- Os endpoints `POST /notifications/test-whatsapp` e `POST /notifications/dispatch-critical` exigem o JWT do Gestor.

**Para repetir a demonstração:** marque como resolvidos os alertas da fazenda, sem apagar o histórico. A próxima sincronização os recria e notifica de novo.

```sql
UPDATE alerts SET resolvido = true WHERE "farmId" = '<id da fazenda>';
```

---

## 5. Dados e Critérios Agronômicos

O motor analítico responde às **7 perguntas oficiais** do desafio com as mesmas regras no cliente ([`analysis.ts`](client/src/offline/analysis.ts)) e na API ([`stock-engine.ts`](api/src/stock-engine/stock-engine.ts)). A rota `POST /stock/analyze` e a reanálise que grava alertas e dispara o WhatsApp usam esse motor. A paridade é verificada por [`parity.spec.ts`](api/src/stock-engine/parity.spec.ts), que roda os dois motores com as mesmas fixtures e a mesma data de referência e exige resultados iguais:
- **O que é comparado:** saldo, consumo, autonomia, confiabilidade, validade, anomalia, parado/excesso, ABC e ordem dos alertas.
- **Fixtures:** a base simulada, litros e quilos juntos, validade hoje, poucas amostras, limiares exatos, listas vazias, zero e preço ausente.
- **Limite:** a paridade vale para essas fixtures, não é uma prova formal para qualquer entrada. As duas cópias precisam mudar juntas, e o teste falha se divergirem.
- **Saldos por unidade:** os saldos são agrupados por unidade (`balancesByUnit`); não existe saldo total somando unidades diferentes.

### 5.1. Critérios de Cálculo e Fórmulas

| Pergunta Oficial do AgroHack | Regra / Critério de Análise Agronômica | Justificativa Gerada |
| :--- | :--- | :--- |
| **1. O que está acabando e precisa ser comprado?** | **Cálculo de Runout Time em Dias de Calendário:**<br>Analisa janela móvel de 30 dias de calendário UTC. Dias amostrados = `today - firstDay + 1` (inclui dias sem retirada). Taxa diária = $\frac{\sum \text{quantidades}}{\text{dias}}$. Autonomia = $\frac{\text{Saldo}}{\text{Taxa}}$. | *“Com o uso médio de 5 sc por dia (últimos 10 dias, contando os dias sem retirada), o estoque dura cerca de 3 dia(s).”* |
| **2. Quais produtos podem vencer antes do uso?** | **Risco de Vencimento vs. Ritmo de Consumo:**<br>Compara os dias até o vencimento ($\Delta t$) com a autonomia. Calcula a sobra estimada: $\text{Sobra} = \text{Saldo} - (\Delta t \times \text{Taxa Diária})$. Se $\text{Sobra} > 0$ e $\Delta t \le 30$ dias, dispara alerta. | *“Vence em 12 dia(s); no ritmo de uso atual (0,1 L por dia), devem sobrar cerca de 38 L sem uso.”* |
| **3. Quanto está sendo consumido de cada produto?** | **Histograma de Consumo Diário:**<br>Mapeamento de saídas por dia de calendário na janela de 30 dias, permitindo visualizar sazonalidade e picos. | Gráfico de barras com histórico diário exibido no painel de cada insumo. |
| **4. Existem consumos fora do padrão?** | **Detecção Estatística de Anomalias:**<br>Exige histórico mínimo de 3 retiradas. Compara a retirada atual com a média das retiradas anteriores. Se $\ge 3\times$ a média, classifica como anomalia grave. | *“Retirada de 950 L, 15,8 vezes a média das 13 retiradas anteriores (60 L). Consideramos fora do padrão a partir de 3 vezes a média.”* |
| **5. Por quanto tempo o estoque será suficiente?** | **Autonomia com base da amostragem:**<br>A interface mostra a quantidade de retiradas e os dias usados no cálculo: "Poucos dados" (1–2 retiradas), "Dados razoáveis" (3–4) ou "Bons dados" (5 ou mais). Sem consumo recente, a previsão fica indisponível. | Indicador heurístico por produto, não confiança estatística nem garantia de duração. |
| **6. Quais produtos representam maior valor financeiro?** | **Curva ABC & Estoque Parado:**<br>- Classe A: até 80% do capital acumulado.<br>- Classe B: 80% a 95% do capital.<br>- Classe C: 95% a 100% do capital.<br>- **Estoque Parado:** Saldo positivo sem nenhuma saída há $\ge 30$ dias.<br>- **Excesso de Estoque:** Autonomia $> 90$ dias. | *“Há saldo, mas nenhuma retirada nos últimos 30 dias. Avalie antes de comprar mais.”* |
| **7. Quais itens merecem atenção imediata?** | **Priorização Tripla de Alertas:**<br>1. **URGENTE:** Estoque zerado, saldo $\le$ mínimo, autonomia $\le 7$ dias ou produto já vencido.<br>2. **ATENÇÃO:** Autonomia entre 8 e 15 dias, sobra antes da validade em até 30 dias ou anomalia de consumo.<br>3. **INFORMATIVO:** Estoque parado há 30 dias ou excesso acima de 90 dias. | Ordenação decrescente de severidade na tela principal do Gestor e acionamento do Twilio. |

### 5.2. Origem dos Dados: Base Simulada

**Todos os dados de demonstração são simulados, criados pela equipe.** Em 27/10/2026 a organização informou que não haverá base oficial e que as equipes devem criar seus próprios dados. O conjunto está em [`official-seed.data.ts`](api/src/stock/official-seed.data.ts) (o nome do arquivo é histórico) e se identifica no campo `origem` como `SIMULADO`.

- **Cobertura:** 9 produtos nas 8 categorias do Anexo III, incluindo Materiais de Irrigação, 2 operadores e histórico de movimentações com os cenários de falta (Ureia), vencimento (Trichoderma), anomalia (Diesel S10) e capital parado (MAP).
- **Carga não destrutiva** ([`demo-load.ts`](api/src/stock/demo-load.ts)): `npx tsx prisma/seed.ts` cria a fazenda de demonstração numa única transação. Ela **não apaga nada**, não toca em outras fazendas e não faz nada se o gestor de demonstração (`gestor@agrohack.com`) já existir. Se uma gravação falhar, nada fica no banco.
- **Relatório de validação:** a carga imprime as linhas válidas, rejeitadas (ref ausente ou duplicada, quantidade ≤ 0, data ou tipo inválidos, produto inexistente) e os tratamentos aplicados:
  - unidades padronizadas (`sacas` → `sc`, `litros` → `L`) ou avisadas quando não reconhecidas;
  - preço ausente ou inválido vira desconhecido, nunca zero;
  - validade inválida é descartada;
  - responsável ausente vira "Não informado".
- **Sem fusões por nome:** refs repetidas são rejeitadas e produtos com nomes parecidos ficam separados.
- **Testes:** [`demo-load.spec.ts`](api/src/stock/demo-load.spec.ts) cobre as regras e os casos de borda. [`demo-load.postgres.integration.ts`](api/test/demo-load.postgres.integration.ts) (`npm run test:sync`) comprova a carga num PostgreSQL descartável: atomicidade, idempotência e outras fazendas intactas.

---

## 6. Demonstração e Casos de Uso

**Vídeo final:** [assista à demonstração do AgroHacka no Drive](https://drive.google.com/file/d/1htR_aHty0eEUVUoWbqxzCKKcaz6VC5T8/view?usp=sharing).

### 6.1. Roteiro Demonstrativo do Sistema
1. **Abertura:** O Gestor visualiza no Dashboard os cartões com contagem de alertas críticos e capital imobilizado.
2. **Identificação de Problema Crítico:** O insumo *Ureia* está abaixo do estoque mínimo, com a justificativa do consumo médio, dos dias de histórico e da autonomia estimada.
3. **Pareamento em 10 Segundos:** O Gestor cadastra o operador e gera um QR Code com código alternativo no formato `AGRO-XXXX`; ao ler o QR, o celular conecta sozinho.
4. **Operação no Campo 100% Offline:** Em modo avião, o operador registra saídas de Diesel S10 e de Ureia. Os registros ficam salvos no aparelho, na fila de sincronização.
5. **Detecção de Anomalia:** Um lançamento atípico de 950 litros de Diesel gera imediatamente um alerta de desvio estatístico.
6. **Convergência e Sincronização:** Ao restabelecer conexão (ou via botão *Sincronizar*), as transações locais sobem para a VPS sem duplicidade e recebem recibos individuais confirmados.
7. **Disparo no WhatsApp:** O alerta urgente é enviado via Twilio para o smartphone do Gestor (pré-requisitos e como reiniciar os alertas na seção 4.4).
8. **Segurança de Dados:** Demonstração do backup automático no SQLite com restauração atômica em 1 clique.

---

## 7. Validação, Testes Automatizados e Limitações

### 7.1. Validação por Testes Automatizados (TDD)
O projeto foi desenvolvido sob a disciplina rigorosa do **Desenvolvimento Orientado a Testes (TDD)**:
- **API NestJS:** 400 testes unitários/HTTP aprovados em 27/10. `npm run test:sync`: 32 testes em PostgreSQL descartável, cobrindo sync, carga de demonstração, produtos e administração/exclusão concorrente de operadores, também aprovados.
- **Desktop/Mobile (Tauri + Vue):** 538 testes Vitest de cadastro, SQLite, interface (incluindo usabilidade no celular), gestão de operadores e empacotamento debug aprovados em 27/10. Os testes e scripts exclusivos de assinatura release foram retirados ao retornar ao debug. Os 5 testes Rust anteriores não foram reexecutados nesta alteração, que não muda o código nativo. O usuário confirmou o teste offline do APK Android anterior; o novo APK e as novas telas ainda exigem validação no aparelho.
- **Validação de Tipos e Build:** `vue-tsc -b` e `vite build` sem warnings ou erros de tipagem.

### 7.2. Registro Transparente de Limitações
Em conformidade com as diretrizes acadêmicas do IFRO, documentamos com clareza os limites da versão atual:
1. **Catálogo de Produtos Centralizado:** O cadastro de novos produtos deve ser realizado na interface do Gestor ou disponibilizado pelo backend; operadores em campo registram movimentações sobre o catálogo sincronizado, não criando novos SKUs offline.
2. **Proteção por Cofre Nativo do SO:** Tokens JWT e backups locais SQLite residem em arquivos do usuário; a criptografia em repouso por cofre nativo (Windows DPAPI / Android Keystore) está mapeada para a próxima versão de produção.
3. **Sincronização por Download Completo:** Enquanto um cursor seguro de CDC (Change Data Capture) não for disponibilizado na API, o cliente baixa o catálogo consistente integral e mescla por UUID, mitigando riscos de janelas temporais cegas.
4. **Câmera em Dispositivos Físicos:** A leitura do QR Code pela câmera foi validada em aparelho Android real (Motorola g75 5G, Android 16): ao ler o QR, o aparelho conecta sozinho. Se a permissão for negada ou não houver câmera, o app orienta usar uma imagem do QR ou o código alfanumérico manual, alternativa de alta resiliência para qualquer situação sem câmera. Outros modelos de aparelho não foram testados.
5. **Sincronização exclusivamente pela internet:** decisão de 26/10. LAN foi cancelada, não adiada; o gestor não atua como servidor intermediário. Sem internet, os lançamentos continuam no SQLite/outbox e são enviados à API central ao reconectar. Em 27/10, a tarefa 5.7-A retirou do cliente o transporte LAN, o uso de IPs antigos e o script de firewall, preservando sessões e pendências. As tarefas 5.7-B/C retiraram da API as rotas `POST /devices/local-ip` e `PUT /sync/heartbeat` e o IP/porta do pareamento e da conexão, e o contrato do cliente foi regenerado; as colunas antigas da fazenda ficam inertes no banco. O plano está em [`ROADMAP_FINALIZACAO.md`](ROADMAP_FINALIZACAO.md). Não é necessário abrir portas no firewall para a sincronização cloud.
6. **Administração de operadores:** o Gestor edita o nome, desativa/reativa (`PATCH /devices/:id`) e exclui (`DELETE /devices/:id`) operadores da própria fazenda. Um aparelho inativo ou excluído é recusado na sincronização (401), inclusive se a exclusão concorrer com um envio, e mantém sua fila local; nomes e movimentações já enviados continuam no histórico. Antes de excluir, convém sincronizar as pendências do aparelho.
7. **WhatsApp na conta de testes da Twilio:** a mensagem chega com o texto do modelo pré-aprovado da Twilio; o alerta completo (insumo, nível, diagnóstico) fica no app. Detalhes na seção 4.4.

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
> *“Ferramentas de Inteligência Artificial Generativa foram utilizadas como assistentes de codificação: **Claude Code** (Anthropic), **Codex/ChatGPT** (OpenAI) e **Gemini** (Google, via Antigravity IDE). Elas auxiliaram na geração de código e scaffolding, na escrita de testes automatizados no ciclo TDD, na revisão de tipagem TypeScript, na investigação de falhas de build e na elaboração de documentação técnica. Toda alteração passou por revisão humana dos integrantes, que definiram os requisitos, as regras de negócio agronômicas, a modelagem e a arquitetura de sincronização, validaram os testes e decidiram o que entrou no repositório por meio de Pull Requests.”*

---

## 9. Autoria, Licença e Segurança

- **Autoria:** Gabriel de Oliveira Silva e Kauê Rian Silva Conceição Oliveira.
- **Licença:** Distribuído sob a licença open-source MIT ([`LICENSE`](LICENSE)); os metadados de `package.json` e `Cargo.toml` seguem a mesma licença.
- **Segurança de Credenciais:** Nenhuma chave privada, credencial de produção, token Twilio ou senha pessoal está exposta no repositório. Variáveis de ambiente sensíveis são gerenciadas exclusivamente através dos painéis protegidos do Coolify na VPS e em arquivos locais `.env` ignorados pelo `.gitignore`.
- **Segredo JWT:** o valor do `.env.example` é público e só serve para desenvolvimento. Com `NODE_ENV=production`, a API **não inicia** sem um `JWT_SECRET` próprio (ausente ou igual ao valor público é recusado).
- **Análise de estoque autorizada:** `POST /stock/analyze` exige o JWT do Gestor ou o `x-device-token` de um operador ativo, e analisa sempre a fazenda da identidade autenticada. Um `farmId` de outra fazenda no corpo da requisição recebe 403.

---

## 10. Versão de Entrega e Rastreabilidade

- **Versão do aplicativo:** **1.0.4**, com instaladores Windows (`.exe`/`.msi`), Windows sem instalador (`app-portable.exe`), Android (`.apk` debug) e Linux (`.AppImage`). [Baixar a release oficial mais recente](https://github.com/GabrielOlisil/AgroHacka/releases/latest).
- **Tag da entrega em compilação:** [`android-build-21`](https://github.com/GabrielOlisil/AgroHacka/releases/tag/android-build-21), referente ao commit [`26aa2ba`](https://github.com/GabrielOlisil/AgroHacka/commit/26aa2ba707fd4a3219365a987282efa8010a9df9). O link da tag ficará disponível após a [execução #21](https://github.com/GabrielOlisil/AgroHacka/actions/runs/40616791559) concluir os três builds e publicar a release. O prefixo histórico `android-build` identifica o build das três plataformas, não apenas o Android.
  - Traz as melhorias de uso no celular da Etapa 11:
    - alertas em linguagem simples;
    - menu inferior;
    - histórico em cartões com a situação de envio;
    - data "agora";
    - busca de insumo e destinos recentes;
    - urgente em vermelho.
- **Versões anteriores:** `v1.0.3-entrega`, `v1.0.2-entrega` (27/10, com o botão de desativar substituído pela gestão completa de operadores na 1.0.3) e `v1.0.1-entrega` (27/10, antes do cadastro de produtos), preservadas sem alteração. O botão Desativar da 1.0.2 não funciona mais com a API atual; use a versão avaliada.
- **Versão anterior:** `v1.0.0-entrega` (21/10), preservada sem alteração.
- **Como as releases são geradas:** cada atualização da `main` compila Windows, Android e Linux e publica uma release oficial `android-build-<número da execução>`, marcada como a mais recente. Tags `v*` publicam uma release com o nome da própria tag. A versão interna do app é definida em `client/src-tauri/tauri.conf.json`; o número do build não altera essa versão.
- **Vídeo final da entrega:** [demonstração no Drive](https://drive.google.com/file/d/1htR_aHty0eEUVUoWbqxzCKKcaz6VC5T8/view?usp=sharing).
- **Repositório Oficial:** [https://github.com/GabrielOlisil/AgroHacka](https://github.com/GabrielOlisil/AgroHacka)
- **Branch de Desenvolvimento:** `dev`
- **Branch de Produção / Entrega:** `main`
- **Data da Apresentação:** 29 de outubro de 2026 — Semana Nacional de Ciência e Tecnologia (SNCT) no IFRO Campus Ariquemes.
