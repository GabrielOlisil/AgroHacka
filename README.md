# 🌾 Paiol — Gestão Inteligente de Insumos Rurais

> **Paiol** é o nome do software: o depósito da fazenda, onde se guardam grãos, sementes e insumos. *AgroHacka* é só o nome do repositório.
>
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
3. **Anomalias Invisíveis:** Desvios ou vazamentos em tanques de combustível passam despercebidos em meio a centenas de anotações manuais.
4. **Capital Parado:** Milhares de reais imobilizados em adubos e peças sem giro, gerando custo de oportunidade financeiro.
5. **Conectividade Precária:** A maioria dos talhões e barracões não possui sinal de internet (Wi-Fi ou 4G/5G). Sistemas web comuns travam ou impedem lançamentos no momento do fato gerador.

### 2.2. Público-Alvo e Apoio à Decisão
- **O Produtor / Gestor Rural:** Precisa de visão panorâmica imediata (quais alertas exigem ação urgente hoje, qual é o valor financeiro do estoque, o que está para vencer e onde o dinheiro está imobilizado).
- **O Operador de Campo (Tratoristas, Almoxarifes, Campeiros):** Precisa de agilidade máxima: registrar uma baixa de insumo ou entrada de compra com 2 toques no celular, mesmo sem nenhuma conexão à internet, sem burocracia e com autoria rastreável.

---

## 3. Solução e Arquitetura

O **Paiol** é uma plataforma híbrida **Offline-First**, estruturada para garantir operação contínua no campo e consolidação confiável em nuvem.

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
- **Docker:** para subir o PostgreSQL local e para os testes de concorrência com PostgreSQL temporário (`npm run test:sync`)

### 4.2. Executando o Backend (API NestJS)

```bash
# 1. Acesse o diretório da API
cd AgroHacka/api

# 2. Crie o .env a partir do exemplo (DATABASE_URL e JWT_SECRET; Twilio é opcional)
cp .env.example .env

# 3. Suba um PostgreSQL local, com o mesmo usuário, senha e banco do DATABASE_URL do exemplo
docker run -d --name paiol-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=agrohacka -p 5432:5432 postgres:16

# 4. Instale as dependências e gere o Prisma Client
npm install
npx prisma generate

# 5. Crie as tabelas aplicando as migrations (antes da carga)
npx prisma migrate deploy

# 6. Execute os testes unitários e de HTTP (não precisam do banco)
npm test

# 7. Opcional: carregue a fazenda de demonstração (dados simulados, não destrutiva; ver seção 5.2)
npx tsx prisma/seed.ts

# 8. Inicie o servidor em modo de desenvolvimento
npm run start:dev
```
A API estará acessível em `http://localhost:3000` (documentação Swagger em `http://localhost:3000/api/docs`).

A carga cria o gestor `gestor@agrohack.com` com a senha `agro1234`, que vale só para o banco local criado por ela. A conta de demonstração da API publicada usa outra senha, que não fica no repositório (tarefa 12.3).

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
- **O que é comparado:** saldo, consumo, autonomia, confiabilidade, validade, anomalia, consumo crescente, cadastro duplicado, parado/excesso, ABC, textos dos alertas (com a ação recomendada) e ordem dos alertas.
- **Fixtures:** a base simulada, litros e quilos juntos, validade hoje, poucas amostras, limiares exatos, listas vazias, zero e preço ausente.
- **Limite:** a paridade vale para essas fixtures, não é uma prova formal para qualquer entrada. As duas cópias precisam mudar juntas, e o teste falha se divergirem.
- **Saldos por unidade:** os saldos são agrupados por unidade (`balancesByUnit`); não existe saldo total somando unidades diferentes.

### 5.1. Critérios de Cálculo e Fórmulas

| Pergunta Oficial do AgroHack | Regra / Critério de Análise Agronômica | Justificativa Gerada |
| :--- | :--- | :--- |
| **1. O que está acabando e precisa ser comprado?** | **Cálculo de Runout Time em Dias de Calendário:**<br>Analisa janela móvel de 30 dias de calendário UTC. Dias amostrados = `today - firstDay + 1` (inclui dias sem retirada). Taxa diária = $\frac{\sum \text{quantidades}}{\text{dias}}$. Autonomia = $\frac{\text{Saldo}}{\text{Taxa}}$.<br>**Quanto comprar:** o suficiente para 30 dias de uso, sem ficar abaixo do mínimo: $\lceil \max(\text{mínimo}, 30 \times \text{Taxa}) - \max(0, \text{Saldo}) \rceil$, com o custo quando há preço. | *“Restam 15 sc, no mínimo ou abaixo do mínimo de 40 sc. Com o uso médio de 4,72 sc por dia (últimos 18 dias), dura cerca de 3,2 dia(s). O que fazer: comprar cerca de 127 sc (cerca de R$ 20320) para 30 dias de uso.”* |
| **2. Quais produtos podem vencer antes do uso?** | **Risco de Vencimento vs. Ritmo de Consumo:**<br>Compara os dias até o vencimento ($\Delta t$) com a autonomia. Calcula a sobra estimada: $\text{Sobra} = \text{Saldo} - (\Delta t \times \text{Taxa Diária})$. Se $\text{Sobra} > 0$ e $\Delta t \le 30$ dias, dispara alerta. | *“Vence em 12 dia(s); no ritmo de uso atual (0,1 L por dia), devem sobrar cerca de 38 L sem uso.”* |
| **3. Quanto está sendo consumido de cada produto?** | **Histograma de Consumo Diário:**<br>Mapeamento de saídas por dia de calendário na janela de 30 dias, permitindo visualizar os picos. | Gráfico de barras com histórico diário exibido no painel de cada insumo. |
| **4. Existem consumos fora do padrão?** | **Retirada fora do padrão (múltiplo da média):**<br>Cada retirada da janela de 30 dias que tenha pelo menos 3 retiradas antes dela é comparada com a média dessas anteriores. Se for $\ge 3\times$ a média, gera alerta de **atenção**; o alerta aponta a de maior múltiplo, com a data.<br>**Consumo crescente:** uso médio por dia dos últimos 15 dias pelo menos 50% maior que o dos 15 anteriores, com 2 ou mais retiradas em cada metade. A metade anterior conta a partir da primeira retirada, para não confundir início de uso com aumento. Nível **atenção**. | *“Retirada de 950 L em 18/10/2026, 15,8 vezes a média das 13 retiradas anteriores (60 L). Consideramos fora do padrão a partir de 3 vezes a média. O que fazer: conferir com quem retirou se a quantidade está certa.”* |
| **5. Por quanto tempo o estoque será suficiente?** | **Autonomia com base da amostragem:**<br>A interface mostra a quantidade de retiradas e os dias usados no cálculo: "Poucos dados" (1–2 retiradas), "Dados razoáveis" (3–4) ou "Bons dados" (5 ou mais). Sem consumo recente, a previsão fica indisponível. | Indicador heurístico por produto, não confiança estatística nem garantia de duração. |
| **6. Quais produtos representam maior valor financeiro?** | **Curva ABC & Estoque Parado:**<br>- Classe A: até 80% do capital acumulado.<br>- Classe B: 80% a 95% do capital.<br>- Classe C: 95% a 100% do capital.<br>- **Estoque Parado:** Saldo positivo sem nenhuma saída há $\ge 30$ dias.<br>- **Excesso de Estoque:** Autonomia $> 90$ dias. | *“Há saldo, mas nenhuma retirada nos últimos 30 dias. O que fazer: não comprar mais até voltar a ter saída.”* |
| **7. Quais itens merecem atenção imediata?** | **Priorização Tripla de Alertas:**<br>1. **URGENTE:** Estoque zerado, saldo $\le$ mínimo, autonomia $\le 7$ dias, produto vencido ou vencendo hoje.<br>2. **ATENÇÃO:** Autonomia entre 8 e 15 dias, sobra antes da validade em até 30 dias, retirada fora do padrão, consumo crescente ou cadastro duplicado (dois ou mais insumos com o mesmo nome, sem contar maiúsculas, acentos, espaços e símbolos).<br>3. **INFORMATIVO:** Estoque parado há 30 dias ou excesso acima de 90 dias. | Resumo no topo da Visão geral do Gestor ("Hoje: 2 compras urgentes, …"), alertas do mais grave para o menos grave e WhatsApp para os urgentes. |

**O que fazer.** Todo alerta termina com uma ação recomendada:

| Alerta | O que fazer |
| :--- | :--- |
| Falta | Comprar cerca de X para 30 dias de uso (ou para voltar ao mínimo), com o custo quando há preço |
| Vencido | Separar o produto e confirmar com o responsável técnico antes de usar ou descartar |
| Perto de vencer | Usar este produto primeiro e não repetir a compra nesse volume |
| Fora do padrão | Conferir com quem retirou se a quantidade está certa |
| Consumo crescente | Conferir se o aumento era esperado e antecipar a próxima compra |
| Cadastro duplicado | Conferir os cadastros e registrar as próximas movimentações em um só |
| Parado e excesso | Não comprar mais até voltar a ter saída ou até o estoque baixar |

**Ordem dos alertas.**
1. Nível: urgente → atenção → informativo.
2. Tipo, no mesmo nível: falta → vencimento → fora do padrão → consumo crescente → cadastro duplicado → parado → excesso. A falta para a operação; o vencimento é perda certa.
3. Gravidade, dentro do tipo: falta com menos dias restantes; vencimento com maior valor da sobra; fora do padrão com maior múltiplo da média; parado e excesso com maior valor em estoque.
4. Empate: maior valor em estoque.

Depois de cada registro, a tela mostra o que mudou na análise: alertas novos, que mudaram de nível e resolvidos. As mesmas regras estão no app, em linguagem simples, na tela **Como funciona**.

**Origem dos limites.** Os limites de 7, 15, 30 e 90 dias, de 3 vezes a média e de 50% são parâmetros escolhidos pela equipe, simples de explicar e de conferir. Não vêm de referência agronômica publicada nem de calibração com produtores: numa fazenda real, devem ser ajustados com a Agronomia, por cultura e época do ano.

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
- **Teste-gabarito:** [`official-seed.spec.ts`](api/src/stock/official-seed.spec.ts) roda a base simulada, com data fixa, no mesmo motor da API e exige exatamente os alertas planejados (falta da Ureia, vencimento e excesso do Trichoderma, Diesel fora do padrão, MAP, Bicos e Respirador parados), sem nenhum alerta nos insumos normais. Para provar que o teste detecta erros, a regra de fora do padrão foi quebrada de propósito (3 → 30 vezes a média) e o gabarito falhou.
- **No app:** a fazenda de demonstração mostra, em todas as telas, o aviso "Dados simulados".
- **Testes:** [`demo-load.spec.ts`](api/src/stock/demo-load.spec.ts) cobre as regras e os casos de borda. [`demo-load.postgres.integration.ts`](api/test/demo-load.postgres.integration.ts) (`npm run test:sync`) comprova a carga num PostgreSQL descartável: atomicidade, idempotência e outras fazendas intactas.

---

## 6. Demonstração e Casos de Uso

**Slides:** [Slides da apresentação](https://claude.ai/artifact/RYQspiozQ9YGQcuYXGnVza#slide-568dce959502)

**Vídeo final:** [assista à demonstração do Paiol no Drive](https://drive.google.com/file/d/1htR_aHty0eEUVUoWbqxzCKKcaz6VC5T8/view?usp=sharing).

### 6.1. Roteiro Demonstrativo do Sistema
1. **Abertura:** O Gestor visualiza no Dashboard os cartões com contagem de alertas críticos e capital imobilizado.
2. **Identificação de Problema Crítico:** O insumo *Ureia* está abaixo do estoque mínimo, com a justificativa do consumo médio, dos dias de histórico e da autonomia estimada.
3. **Pareamento em 10 Segundos:** O Gestor cadastra o operador e gera um QR Code com código alternativo no formato `AGRO-XXXX`; ao ler o QR, o celular conecta sozinho.
4. **Operação no Campo 100% Offline:** Em modo avião, o operador registra saídas de Diesel S10 e de Ureia. Os registros ficam salvos no aparelho, na fila de sincronização.
5. **Retirada fora do padrão:** Um lançamento atípico de 950 litros de Diesel gera um alerta de atenção, com a data, o múltiplo da média e o que fazer.
6. **Reanálise visível:** depois de salvar, a tela mostra o que mudou na análise (alertas novos, que mudaram de nível e resolvidos).
7. **Convergência e Sincronização:** Ao restabelecer conexão (ou no botão *Atualizar agora*), as transações locais sobem para a VPS sem duplicidade e recebem recibos individuais confirmados.
8. **Disparo no WhatsApp:** O alerta urgente é enviado via Twilio para o smartphone do Gestor (pré-requisitos e como reiniciar os alertas na seção 4.4).
9. **Segurança de Dados:** Demonstração do backup automático no SQLite com restauração atômica em 1 clique.

---

## 7. Validação, Testes Automatizados e Limitações

### 7.1. Validação por Testes Automatizados (TDD)
O projeto foi desenvolvido sob a disciplina rigorosa do **Desenvolvimento Orientado a Testes (TDD)**:
- **API NestJS:** 386 testes unitários e de HTTP aprovados em 29/10, incluindo o teste-gabarito da base simulada (seção 5.2) e a paridade com o motor do app. `npm run test:sync`: 32 testes em PostgreSQL descartável, cobrindo sync, carga de demonstração, produtos e administração/exclusão concorrente de operadores, aprovados na última execução, em 27/10.
- **Desktop/Mobile (Tauri + Vue):** 613 testes Vitest aprovados em 29/10, cobrindo cadastro, SQLite, interface (incluindo usabilidade no celular, linguagem simples e paginação), regras e textos dos alertas, gestão de operadores e empacotamento. Os 5 testes Rust não foram reexecutados nesta etapa, que não muda o código nativo.
- **Integração contínua:** o GitHub Actions roda os testes da API e os testes e a checagem de tipos do app a cada push e Pull Request na `dev` e na `main` ([`ci.yml`](.github/workflows/ci.yml)).
- **Validação de Tipos e Build:** `vue-tsc -b` e `vite build` sem warnings ou erros de tipagem.
- **Em aparelho real:** o modo offline (registro em modo avião, "Esperando envio" e envio ao reconectar), o pareamento por QR Code e o WhatsApp foram testados pela equipe num celular Motorola g75 5G (Android 16) e gravados no vídeo de 28/10. Não há medições de desempenho.
- **Retorno do público:** a equipe **não** conseguiu mostrar o app a produtores nem à Agronomia antes da final. A validação é só técnica (testes, gabarito e uso pela própria equipe).

### 7.2. Registro Transparente de Limitações
Em conformidade com as diretrizes acadêmicas do IFRO, documentamos com clareza os limites da versão atual:
1. **Catálogo de Produtos Centralizado:** O cadastro de novos produtos deve ser realizado na interface do Gestor ou disponibilizado pelo backend; operadores em campo registram movimentações sobre o catálogo sincronizado, não criando novos SKUs offline.
2. **Proteção por Cofre Nativo do SO:** Tokens JWT e backups locais SQLite residem em arquivos do usuário; a criptografia em repouso por cofre nativo (Windows DPAPI / Android Keystore) está mapeada para a próxima versão de produção.
3. **Sincronização por Download Completo:** Enquanto um cursor seguro de CDC (Change Data Capture) não for disponibilizado na API, o cliente baixa o catálogo consistente integral e mescla por UUID, mitigando riscos de janelas temporais cegas.
4. **Câmera em Dispositivos Físicos:** A leitura do QR Code pela câmera foi validada em aparelho Android real (Motorola g75 5G, Android 16): ao ler o QR, o aparelho conecta sozinho. Se a permissão for negada ou não houver câmera, o app orienta usar uma imagem do QR ou o código alfanumérico manual, alternativa de alta resiliência para qualquer situação sem câmera. Outros modelos de aparelho não foram testados.
5. **Sincronização exclusivamente pela internet:** decisão de 26/10. LAN foi cancelada, não adiada; o gestor não atua como servidor intermediário. Sem internet, os lançamentos continuam no SQLite/outbox e são enviados à API central ao reconectar. Em 27/10, a tarefa 5.7-A retirou do cliente o transporte LAN, o uso de IPs antigos e o script de firewall, preservando sessões e pendências. As tarefas 5.7-B/C retiraram da API as rotas `POST /devices/local-ip` e `PUT /sync/heartbeat` e o IP/porta do pareamento e da conexão, e o contrato do cliente foi regenerado; as colunas antigas da fazenda ficam inertes no banco. O plano está em [`ROADMAP_FINALIZACAO.md`](ROADMAP_FINALIZACAO.md). Não é necessário abrir portas no firewall para a sincronização cloud.
6. **Administração de operadores:** o Gestor edita o nome, desativa/reativa (`PATCH /devices/:id`) e exclui (`DELETE /devices/:id`) operadores da própria fazenda. Um aparelho inativo ou excluído é recusado na sincronização (401), inclusive se a exclusão concorrer com um envio, e mantém sua fila local; nomes e movimentações já enviados continuam no histórico. Antes de excluir, convém sincronizar as pendências do aparelho.
7. **WhatsApp na conta de testes da Twilio:** a mensagem chega com o texto do modelo pré-aprovado da Twilio; o alerta completo (insumo, nível, diagnóstico) fica no app. Detalhes na seção 4.4.
8. **Previsão simples:** a duração usa a média dos últimos 30 dias, sem considerar a cultura nem a época do ano. Os limites dos alertas são parâmetros da equipe (seção 5.1), ainda não calibrados com a Agronomia.
9. **Sem importação de planilha:** os dados entram pelo app (cadastro e movimentações) ou pela carga de demonstração reproduzível.
10. **Lote, validade e preço por produto:** cada insumo tem um lote, uma validade e um preço vigentes. Lotes com validades diferentes e variação de preço entre compras não são tratados. Cadastros duplicados só são detectados quando o nome é o mesmo sem contar maiúsculas, acentos, espaços e símbolos; nomes parecidos, como "Ureia" e "Uréia granulada", não são comparados, e o app não junta os cadastros sozinho.
11. **Sem retorno do público:** ver seção 7.1.

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

**Revisão humana por parte do projeto:**

| Parte | Quem revisou | O que foi conferido |
| :--- | :--- | :--- |
| Motor de análise (app e API) | Kauê | Regras contra o gabarito calculado à mão, teste de mutação, paridade entre os dois motores e textos dos alertas |
| API, sincronização e banco | Kauê | Testes de HTTP e com PostgreSQL real, idempotência, travas por fazenda e credenciais da demonstração |
| Telas do app (Vue) | Gabriel | Testes de interface, linguagem simples, uso no celular e fluxo offline no aparelho |
| Empacotamento e CI (Tauri, GitHub Actions) | Gabriel | Builds de Windows, Linux e Android e instalação no aparelho |
| Documentação | Kauê e Gabriel | Conferência com o código e com os testes |

Na reta final (28/10, Etapa 12), parte das telas (aviso de dados simulados, resumo no topo, "o que mudou", tela Como funciona e nome Paiol) foi feita e revisada pelo Kauê, para adiantar as tarefas do Gabriel.

---

## 9. Autoria, Licença e Segurança

- **Autoria:** Gabriel de Oliveira Silva e Kauê Rian Silva Conceição Oliveira.
- **Licença:** Distribuído sob a licença open-source MIT ([`LICENSE`](LICENSE)); os metadados de `package.json` e `Cargo.toml` seguem a mesma licença.
- **Segurança de Credenciais:** Nenhuma chave privada, credencial de produção, token Twilio ou senha pessoal está exposta no repositório. Variáveis de ambiente sensíveis são gerenciadas exclusivamente através dos painéis protegidos do Coolify na VPS e em arquivos locais `.env` ignorados pelo `.gitignore`.
- **Segredo JWT:** o valor do `.env.example` é público e só serve para desenvolvimento. Com `NODE_ENV=production`, a API **não inicia** sem um `JWT_SECRET` próprio (ausente ou igual ao valor público é recusado).
- **Análise de estoque autorizada:** `POST /stock/analyze` exige o JWT do Gestor ou o `x-device-token` de um operador ativo, e analisa sempre a fazenda da identidade autenticada. Um `farmId` de outra fazenda no corpo da requisição recebe 403.

---

## 10. Versão de Entrega e Rastreabilidade

- **Versão avaliada na final:** **1.1.3**, tag [`v1.1.3`](https://github.com/GabrielOlisil/AgroHacka/releases/tag/v1.1.3), com instaladores Windows (`.exe`/`.msi`), Windows sem instalador (`app-portable.exe`), Android (`.apk` debug) e Linux (`.AppImage`). A tag identifica o commit avaliado e foi informada à organização até 30/10/2026 às 14h. Depois disso, o repositório fica congelado.
  - Traz as melhorias da Etapa 12 (final presencial):
    - todo alerta diz o que fazer, incluindo quanto comprar para 30 dias e o custo; no app, o "O que fazer" aparece em linha própria, em negrito (1.1.1);
    - alertas do mais grave para o menos grave e resumo no topo para o gestor;
    - fora do padrão em toda a janela de 30 dias e alerta de consumo crescente;
    - alerta de possível cadastro duplicado (1.1.3);
    - "o que mudou" depois de cada registro;
    - tela Como funciona;
    - paginação no Histórico, no Estoque e nos Operadores, com escolha de 10, 25, 50 ou 100 itens por página (1.1.2);
    - aviso de dados simulados na fazenda de demonstração;
    - nome Paiol;
    - testes do app no CI.
- **Versão do vídeo de 28/10:** app 1.0.4, release `android-build-22` (a primeira com Windows, Android e Linux juntos), com as melhorias de uso no celular da Etapa 11. O roteiro antigo citava a tag `v1.0.4-entrega`, que nunca foi criada.
- **Versões anteriores:** `v1.1.2` (29/10, igual à 1.1.3 sem o alerta de cadastro duplicado), `v1.1.1` (29/10, igual à 1.1.2 sem a paginação), `v1.1.1-final` (29/10, o mesmo app da `v1.1.1`, com o nome antigo da tag), `v1.1.0-final` (29/10, igual à 1.1.1 sem o destaque do "O que fazer"), `v1.0.3-entrega`, `v1.0.2-entrega` (27/10, com o botão de desativar substituído pela gestão completa de operadores na 1.0.3), `v1.0.1-entrega` (27/10, antes do cadastro de produtos) e `v1.0.0-entrega` (21/10), preservadas sem alteração. O botão Desativar da 1.0.2 não funciona mais com a API atual; use a versão avaliada.
- **Como as releases são geradas:** cada atualização da `main` compila Windows, Android e Linux e publica uma release oficial `android-build-<número da execução>`, marcada como a mais recente; o prefixo histórico `android-build` vale para as três plataformas. Tags `v*`, como a `v1.1.3`, publicam uma release com o nome da própria tag. A versão interna do app é definida em `client/src-tauri/tauri.conf.json`; o número do build não altera essa versão.
- **Vídeo final da entrega:** [demonstração no Drive](https://drive.google.com/file/d/1htR_aHty0eEUVUoWbqxzCKKcaz6VC5T8/view?usp=sharing).
- **Slides:** [Slides da apresentação](https://claude.ai/artifact/RYQspiozQ9YGQcuYXGnVza#slide-568dce959502)
- **Repositório Oficial:** [https://github.com/GabrielOlisil/AgroHacka](https://github.com/GabrielOlisil/AgroHacka)
- **Branch de Desenvolvimento:** `dev`
- **Branch de Produção / Entrega:** `main`
- **Data da Apresentação:** 30 de outubro de 2026, às 19h15 — final presencial do AGROHACK 2026/2 no Auditório do CEI (Centro de Empreendedorismo e Inovação), IFRO Campus Ariquemes.
