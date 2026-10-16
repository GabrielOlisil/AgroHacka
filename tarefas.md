# 📋 Plano de Tarefas e Arquitetura — AgroHack 2026/2 (IFRO)

> **Desafio Oficial:** Gestão Inteligente de Insumos em uma Propriedade Rural  
> **Objetivo:** Transformar registros de estoque em informações úteis para identificar problemas, antecipar necessidades e apoiar decisões de forma simples e eficiente.  
> **Data de Apresentação:** 29 de outubro de 2026 (Semana Nacional de Ciência e Tecnologia - SNCT)  
> **Premiação:** R$ 2.000,00  

---

## 🏗️ Resumo da Arquitetura e Decisões Técnicas

| Camada / Recurso | Tecnologia | Função e Comportamento |
| :--- | :--- | :--- |
| **Backend Central** | **NestJS + TypeScript** | API REST central, autenticação do Gestor, orquestração de sincronização e Webhooks |
| **Banco Central** | **PostgreSQL + Prisma ORM** | Persistência central em nuvem, histórico consolidado multi-dispositivos |
| **Clientes** | **Tauri v2 + Vue 3 (Desktop .exe & Mobile .apk)** | **Paridade total de código e recursos:** mesma base Vue 3 responsiva para ambos |
| **Perfis de Dispositivo** | **Nó Gestor** vs. **Nó Operador** | **Central Dinâmica:** qualquer dispositivo pode ser o Gestor ou Operador |
| **Banco Local** | **SQLite local** (Tauri SQL Plugin) | Operação **100% Offline-First** em todos os dispositivos |
| **Backup Automático** | **Snapshots SQLite (Estilo Anki)** | Cópias atômicas diárias (`VACUUM INTO`), retenção de 7 dias e restauração com 1 clique |
| **Sincronização Híbrida** | **Local (LAN) primeiro $\rightarrow$ Nuvem depois** | Tenta rota local na rede Wi-Fi (timeout 500ms); se falhar, envia para a Nuvem |
| **Descoberta de IP** | **Heartbeat na Nuvem + mDNS local** | Atualização automática de IP local sem qualquer intervenção humana |
| **Firewall do Windows** | **Regra nativa no instalador do .exe** | Liberação automática da porta TCP de sincronização local em redes privadas |
| **Pareamento Flexível** | **QR Code + Código Manual Alternativo** | Vincula o Nó Operador informando o nome do operador com ou sem câmera |
| **Inteligência de Estoque** | **Motor Híbrido (TypeScript puro)** | Regras de alertas executam localmente no SQLite e também no Backend |
| **Notificações Críticas** | **Twilio API (WhatsApp)** | Envio automático de alertas urgentes para o WhatsApp cadastrado do Gestor |

---

## 📌 Fase 1: Gestão de Inscrição, Equipe e Repositório
*Obrigatório pelo regulamento oficial do evento.*

- [ ] **1.1. Conferência cadastral:** Validar número de protocolo e chave da equipe na plataforma [incubadora.cloud/agrohack](https://incubadora.cloud/agrohack/).
- [ ] **1.2. Acesso ao GitHub:** Garantir que o repositório esteja acessível à banca avaliadora.
- [ ] **1.3. Submissão do repositório:** Inserir a URL do GitHub na área "Minha equipe" no site oficial dentro do prazo limite.
- [ ] **1.4. Identificação da versão de entrega:** Criar uma `git tag` (ex: `v1.0.0-entrega`) e registrar o commit final para avaliação.

---

## 🗄️ Fase 2: Backend Central & Modelagem (NestJS + PostgreSQL + Prisma)
*Estruturação da API central e modelo relacional multi-dispositivo.*

- [ ] **2.1. Configuração do Prisma no NestJS (`api/`):**
  - [ ] Inicializar o Prisma (`npx prisma init`) apontando para o PostgreSQL.
  - [ ] Modelar tabelas relacionais com UUIDs e timestamps:
    - `Farm` (id, nome, gestor_id, local_ip, local_port, created_at, updated_at).
    - `User` (id, farm_id, nome, email, senha_hash, role: GESTOR | OPERADOR, created_at).
    - `Device` (id, farm_id, user_id, device_token, nome_dispositivo, pairing_code, ativo).
    - `Product` (id, farm_id, nome, categoria, unidade_medida, estoque_minimo, preco_aquisicao, validade, lote, fornecedor, updated_at).
    - `StockMovement` (id, farm_id, product_id, tipo: ENTRADA/SAIDA, quantidade, data_movimento, destino, operador_nome, updated_at).
    - `Alert` (id, farm_id, product_id, nivel_urgencia: ALTA/MEDIA/BAIXA, justificativa, data_geracao, resolvido).
  - [ ] Executar migrations no PostgreSQL.
- [ ] **2.2. Endpoints da API REST:**
  - [ ] Autenticação do Gestor (`POST /auth/register`, `POST /auth/login`).
  - [ ] Pareamento de Dispositivos:
    - `POST /devices/pairing-token`: Gestor gera token/QR Code e código alfanumérico com o nome do Operador.
    - `POST /devices/connect`: Nó Operador envia o token ou código alfanumérico para validação e vínculo.
  - [ ] Presença e Descoberta de Rede (`PUT /farm/heartbeat`): Registra o IP e porta local mais recentes do Nó Gestor.
  - [ ] Sincronização em Lote (`POST /sync`): Recebe movimentações locais pendentes e retorna atualizações incrementais do servidor.
  - [ ] Reanálise Central de Estoque (`POST /stock/analyze`): Processa dados e gera novos alertas.
- [ ] **2.3. Carga de Dados e Seed:**
  - [ ] Criar script `prisma/seed.ts` com dados simulados contendo anomalias e rotinas normais para validação.
  - [ ] Preparar rotina para importar a base de dados oficial do evento assim que disponibilizada pela organização.

---

## 🧠 Fase 3: Motor Híbrido de Inteligência de Estoque (TypeScript Puro)
*Módulo de regras de negócio compartilhado entre Backend, Desktop e Mobile — responde às 7 perguntas do desafio.*

- [ ] **3.1. Tratamento e Higienização de Registros:**
  - [ ] Padronização de grafias diferentes do mesmo insumo.
  - [ ] Tratamento e conversão de unidades de medida (não misturar litros com quilos sem tratamento).
  - [ ] Tratamento de campos ausentes (ausência de preço ou validade não pode ser tratada como zero).
- [ ] **3.2. Risco de Falta e Estimativa de Duração (Runout Time):**
  - [ ] Identificar saldo abaixo do estoque mínimo.
  - [ ] Calcular taxa média de consumo diário/semanal baseada no histórico.
  - [ ] Estimar dias de autonomia com justificativa clara (ex: *"Mantendo o consumo recente, o saldo será suficiente por aproximadamente 8 dias"*).
  - [ ] Indicar nível de incerteza para itens com poucas movimentações registradas.
- [ ] **3.3. Risco de Vencimento vs. Taxa de Consumo:**
  - [ ] Alertar produtos próximos da validade antes do consumo estimado total.
- [ ] **3.4. Tendência e Padrão de Consumo:**
  - [ ] Mapear variações temporais (picos de consumo sazonal e aumentos progressivos).
- [ ] **3.5. Detecção de Anomalias e Movimentações Fora do Padrão:**
  - [ ] Detectar retiradas em volumes discrepantes da média histórica da propriedade.
- [ ] **3.6. Concentração Financeira e Excesso de Estoque:**
  - [ ] Classificação Curva ABC de capital imobilizado.
  - [ ] Destacar insumos de alto valor com baixa rotatividade (capital travado).
- [ ] **3.7. Motor de Priorização de Alertas:**
  - [ ] Categorizar alertas em níveis: Urgente, Atenção, Informativo.
  - [ ] Apresentar lista priorizada: *"Quais itens merecem atenção imediata e por quê"*.

---

## 💾 Fase 4: Persistência Local, Backup Automático e Sincronização Híbrida
*Funcionamento robusto no campo rural com garantia de integridade.*

- [ ] **4.1. SQLite Local via Tauri Plugin:**
  - [ ] Configurar `@tauri-apps/plugin-sql` no projeto compartilhado.
  - [ ] Criar schema SQLite local idêntico com tabela de controle `sync_outbox` (registros pendentes de envio).
- [ ] **4.2. Sistema de Backup Automático (Estilo Anki):**
  - [ ] Implementar rotina de snapshot atômico do SQLite via comando `VACUUM INTO 'backups/backup-[timestamp].db'`.
  - [ ] Disparo automático diário ao iniciar a aplicação ou antes de cada sincronização pesada.
  - [ ] Política de retenção rotativa: manter os últimos 7 backups diários, removendo os mais antigos automaticamente.
  - [ ] Interface visual simples em *Configurações > Backups*: listagem das cópias com botão "Restaurar em 1 Clique".
- [ ] **4.3. Motor de Sincronização Híbrida (Local Primeiro $\rightarrow$ Nuvem Depois):**
  - [ ] Ao sincronizar, disparar ping rápido (500ms) no IP local do Nó Gestor na rede Wi-Fi.
  - [ ] Se o Nó Gestor responder localmente: enviar dados diretamente via LAN (rápido e sem gastar internet).
  - [ ] Se não responder: enviar para o endpoint da Nuvem (`POST /sync`).
  - [ ] Resolução de conflitos usando timestamp mais recente (`updated_at`) e UUIDs para evitar duplicações.
- [ ] **4.4. Atualização Automática de IP Local (Zero Ação Manual):**
  - [ ] O Nó Gestor identifica seu IP na rede local e envia heartbeat periódico para a Nuvem.
  - [ ] Anúncio e descoberta local via mDNS na rede Wi-Fi para que os Nós Operadores encontrem o Gestor mesmo sem internet.

---

## 💻 Fase 5: Central Dinâmica e Paridade de Recursos (Desktop e Mobile)
*A mesma base de código Vue 3 servindo com perfeição para o Nó Gestor e Nó Operador.*

- [ ] **5.1. Fluxo de Inicialização e Boas-Vindas:**
  - [ ] Tela inicial com duas escolhas claras:
    - 🏢 **"Criar Nova Fazenda" (Nó Gestor):** Exige cadastro/login com email e senha para vincular a fazenda na nuvem.
    - 📱 **"Conectar a uma Fazenda Existente" (Nó Operador):** Abre a tela de pareamento com passo a passo ilustrado.
- [ ] **5.2. Mecanismo de Pareamento Duplo (QR Code + Código Manual):**
  - [ ] **No Nó Gestor:**
    - Modal *"Adicionar Dispositivo"*: campo para digitar o nome do operador (ex: *"Carlos Silva - Tratorista"*).
    - Gera na tela o **QR Code** (contendo Farm ID, Worker Name, Device Token, IP Local e Porta).
    - Exibe logo abaixo o **Código Alfanumérico Alternativo de 6 caracteres** (ex: `AGRO-88`).
  - [ ] **No Nó Operador:**
    - Opção padrão: apontar a câmera e escanear o QR Code.
    - Opção alternativa: botão *"Digitar Código Manualmente"* para casos em que a câmera não funcione.
    - Ao confirmar, o dispositivo grava o perfil do Operador no SQLite local e conclui a conexão.
- [ ] **5.3. Telas e Funcionalidades com Paridade Total:**
  - [ ] **Visão do Gestor:** Dashboard com indicadores, alertas críticos, Curva ABC, relatórios, cadastros completos e gestão de backups.
  - [ ] **Visão do Operador:** Interface com botões grandes de acesso rápido para "Registrar Saída" e "Registrar Entrada" (com o nome do operador já pré-preenchido e bloqueado), além de consulta rápida de estoque.
  - [ ] Responsividade Mobile-First (a mesma tela se adapta de monitores desktop para telas de smartphone).

---

## 📦 Fase 6: Empacotamento e Configuração de Instaladores
*Facilidade de uso sem configurações técnicas manuais.*

- [ ] **6.1. Instalador do Desktop (.exe):**
  - [ ] Configurar build do executável Windows via Tauri (`cargo tauri build`).
  - [ ] Configurar script do instalador (MSI/NSIS) para criar automaticamente a regra no Firewall do Windows:
    `netsh advfirewall firewall add rule name="AgroHack Local Server" dir=in action=allow protocol=TCP localport=3333 profile=private`
  - [ ] Testar instalação silenciosa em máquina Windows limpa.
- [ ] **6.2. Pacote Mobile (.apk):**
  - [ ] Configurar build do Android via Tauri Mobile (`tauri android build`).
  - [ ] Testar instalação e execução da `.apk` em celular Android real.

---

## 📲 Fase 7: Alertas Críticos no WhatsApp (Twilio API)
*Diferencial prático de alto impacto na avaliação da banca.*

- [ ] **7.1. Integração com Twilio WhatsApp:**
  - [ ] Configurar credenciais Twilio na API NestJS (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`).
  - [ ] Cadastrar número de WhatsApp do Gestor nas configurações da fazenda.
- [ ] **7.2. Template de Notificação e Disparo Automático:**
  - [ ] Criar mensagem formatada e objetiva:
    > ⚠️ *ALERTA AGROHACK — GESTÃO DE ESTOQUE*  
    > *Insumo:* Ureia Fertilizante  
    > *Nível:* CRÍTICO  
    > *Diagnóstico:* Mantendo a média de consumo recente, o saldo acaba em **2 dias**.  
    > *Ação recomendada:* Programar novo pedido com o fornecedor.
  - [ ] Disparar mensagem automaticamente quando a reanálise detectar alerta de nível ALTO/CRÍTICO.
  - [ ] Botão no painel do Gestor para envio de teste para o WhatsApp.

---

## 🧪 Fase 8: Testes, Validação e Limitações
*Critério de 15 pontos da banca avaliadora.*

- [ ] **8.1. Testes com a base oficial do desafio:** Carregar os dados oficiais da organização e conferir identificação de todas as anomalias.
- [ ] **8.2. Validação da Sincronização Híbrida e Modo Offline:**
  - [ ] Realizar movimentações com o dispositivo 100% desconectado da internet.
  - [ ] Reconectar na rede Wi-Fi local e validar envio direto para o Nó Gestor sem internet externa.
  - [ ] Desligar o Nó Gestor e validar sincronização automática via Nuvem (4G).
- [ ] **8.3. Validação do Backup Automático:**
  - [ ] Simular exclusão/alteração de registros e restaurar o snapshot do SQLite com 1 clique.
- [ ] **8.4. Mapeamento de Limitações:**
  - [ ] Documentar o que a solução faz com precisão e limitações conhecidas (ex: estimativa com menos de 3 movimentações é conservadora).

---

## 📄 Fase 9: Documentação Obrigatória do Repositório (README.md)
*Estrutura estrita exigida pelo Anexo II do regulamento.*

- [ ] **9.1. Equipe:** Nomes, cursos, funções no projeto e identificação do responsável (ADS).
- [ ] **9.2. Problema e Público:** Contextualização rural, dores de estoque e tomada de decisão de Gestores e Operadores.
- [ ] **9.3. Solução:** Descrição da arquitetura híbrida, Central Dinâmica, Offline-First e paridade Desktop/Mobile.
- [ ] **9.4. Como Testar:** Instruções passo a passo reproduzíveis para execução e links para download do `.exe` e `.apk`.
- [ ] **9.5. Dados e Critérios:** Dicionário dos campos, tratamentos de unidades/grafias, fórmulas dos alertas e limites das estimativas.
- [ ] **9.6. Demonstração:** Link do vídeo, prints das telas principais e evidência de reanálise imediata após novas movimentações.
- [ ] **9.7. Validação e Testes:** Resumo dos testes com os dados oficiais e registro das limitações.
- [ ] **9.8. Tecnologias e Declaração de IA:** Ferramentas utilizadas e declaração formal do uso de IA (finalidades, revisões humanas ou ausência de uso).
- [ ] **9.9. Autoria e Licença:** Termos de uso, referências e garantia de que nenhuma chave ou credencial está exposta.
- [ ] **9.10. Versão de Entrega:** Tag e commit final avaliado.

---

## 🎬 Fase 10: Vídeo Demonstrativo e Materiais de Apresentação
*Entregáveis obrigatórios no repositório antes do evento.*

- [ ] **10.1. Gravação do Vídeo Demonstrativo (3 a 5 min):**
  - [ ] 1. Visão do Gestor com dados reais e alertas críticos.
  - [ ] 2. Pareamento do Nó Operador via QR Code e via Código Alfanumérico.
  - [ ] 3. Registro de saída offline pelo Operador no campo.
  - [ ] 4. Sincronização local/nuvem e reanálise instantânea dos alertas na tela do Gestor.
  - [ ] 5. Recebimento da notificação do alerta no WhatsApp via Twilio.
  - [ ] 6. Demonstração do Backup Automático e restauração em 1 clique (estilo Anki).
- [ ] **10.2. Produção dos Slides do Pitch:**
  - [ ] Slides salvos em PDF no repositório focados no problema rural, demonstração ao vivo, impacto financeiro e viabilidade técnica.

---

## 🏆 Fase 11: Apresentação Final (SNCT — 29/10/2026)
*Banca avaliadora presencial no IFRO Campus Ariquemes.*

- [ ] **11.1. Ensaio Geral da Apresentação:** Cronometragem e revezamento da fala entre os integrantes da equipe.
- [ ] **11.2. Preparação para a Sabatina:** Alinhar respostas técnicas sobre decisões de arquitetura, consistência offline, critérios de cálculos e uso responsável de IA.
- [ ] **11.3. Checklist Presencial:** Aparelhos carregados, `.exe` e `.apk` testados e presença confirmada de toda a equipe.
