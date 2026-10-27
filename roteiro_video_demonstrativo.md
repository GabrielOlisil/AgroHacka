# 🎬 Roteiro — Vídeo Demonstrativo AgroHack 2026

**Equipe:** Oliveira & Oliveira | Gabriel de Oliveira Silva & Kauê Rian Silva Conceição Oliveira
**Protocolo:** AGRO26-F009CD2F9F | ADS 6º Período — IFRO Campus Ariquemes
**Versão demonstrada:** `v1.0.1-entrega` ([Releases](https://github.com/GabrielOlisil/AgroHacka/releases/tag/v1.0.1-entrega))
**Meta de duração:** 5 a 7 minutos (o regulamento não fixa limite; a tarefa 8.1 previa 3 a 5)
**Entrega:** YouTube como **Não listado** → link para a coordenação **até 27/10, 22h (horário de Ariquemes)** → link no README

---

## 1. O que o vídeo precisa provar

O regulamento (itens 7e e 7g) pede o vídeo demonstrativo e a **demonstração da atualização dos registros e da reanálise**. Cada item abaixo precisa aparecer na tela:

| Item | Cena |
|---|---|
| Problema e público (gestor e operador) | 2 |
| Solução e arquitetura (API na nuvem + app Windows/Android, offline) | 3 |
| Alertas com justificativa: falta, vencimento, consumo anômalo, capital parado (ABC) | 4 e 5 |
| Dados simulados identificados como tal | 5 |
| Pareamento do operador (QR e código) | 6 |
| Registro offline | 7 |
| **Atualização dos registros e reanálise** depois de sincronizar | 8 |
| Alerta urgente no WhatsApp | 9 |
| Backup e restauração | 10 |

---

## 2. Pré-requisitos (faça antes de começar a gravar)

### 2.1 Software e aparelhos
- [ ] **Notebook com Windows** e o instalador da `v1.0.1-entrega` instalado (`agrohacka_0.1.0_x64-setup.exe` da página de Releases). O número `0.1.0` no nome do arquivo é a versão interna do app; o que identifica a entrega é a tag.
- [ ] **Celular Android** com o `app-universal-debug.apk` da mesma release instalado. Se já houver uma versão antiga, instale por cima.
  - O celular precisa começar **sem estar pareado**, para gravar a Cena 6. Se já estiver conectado, toque em **Sair** no app antes de gravar.
- [ ] **OBS Studio** (gratuito) configurado com captura da tela inteira (1920×1080) e microfone.
- [ ] Um jeito de filmar o celular: outro celular num suporte, a webcam apontada para a mesa, ou o espelhamento do Android com o scrcpy.
- [ ] Notebook carregado, notificações do Windows silenciadas e abas pessoais fechadas.

### 2.2 API e dados
- [ ] **API no ar:** abra o Coolify e confirme que o deploy da `main` (release de 27/10) terminou e o log mostra a API iniciada.
- [ ] **Conta do gestor:** use a conta da fazenda que já tem a **base simulada** (Ureia, Trichoderma, Diesel S10, MAP, etc.). Faça login no app desktop e confira:
  - **Visão geral → Alertas prioritários** mostra alertas;
  - **Estoque** mostra os insumos com saldo, a curva ABC e os valores.
- [ ] **Saldo da Ureia:** anote o saldo atual na aba **Estoque**. Na Cena 7, a saída de Ureia tem de ser **menor que esse saldo** (o roteiro usa 2 sacas; ajuste se precisar).

### 2.3 WhatsApp (Twilio)
- [ ] **Número do gestor:** em **Visão geral → Alertas de emergência via WhatsApp**, o número salvo é o seu celular **sem o 9 depois do DDD** (o mesmo formato verificado na Twilio).
- [ ] **Twilio ativo:** do WhatsApp do gestor, mande `join twilio-trial` para **+1 737 250 8034** (se as mensagens pararam de chegar ou se faz tempo desde o último envio).
- [ ] **Teste rápido, uma vez só:** toque em **Testar envio de alerta** e confirme que a mensagem chega. Cada envio gasta uma das mensagens grátis da conta trial.

### 2.4 Logo antes da Cena 7: resolver os alertas abertos
Se o alerta da Ureia já estiver aberto no banco, a sincronização **não** gera WhatsApp novo, porque o alerta já existe. Rode no terminal do PostgreSQL do Coolify (troque o e-mail pelo da conta do gestor usada no vídeo):

```sql
UPDATE alerts SET resolvido = true
WHERE "farmId" = (SELECT "farmId" FROM users WHERE email = 'EMAIL_DO_GESTOR');
```

Depois disso, **a próxima movimentação sincronizada** recria os alertas e dispara o WhatsApp de cada alerta **urgente**. Pode chegar mais de uma mensagem (uma por insumo urgente).

> Por isso o SQL vai logo antes da Cena 7: se alguém registrar e sincronizar uma movimentação antes, o WhatsApp sai fora da gravação.

---

## 3. Ordem de gravação recomendada

| Bloco | Cenas | Como gravar |
|---|---|---|
| A | 1, 2, 3, 11 | Câmera frontal ou slides com voz. Pode ser gravado a qualquer momento. |
| B | 4, 5, 10 | Captura de tela do desktop. |
| C | **6, 7, 8, 9** | **Uma tomada contínua**, com captura do desktop e filmagem do celular ao mesmo tempo. Essas cenas dependem umas das outras: pareamento → registro offline → sincronização → WhatsApp. |

Rode o SQL da seção 2.4 logo antes de começar o bloco C.

---

## 4. Roteiro cena a cena

Legenda: **🖱️ Ação** é o que fazer na tela. As falas em itálico são sugestões e podem ser ditas com as próprias palavras, desde que as informações continuem corretas.

### 🎬 CENA 1 — Abertura (≈ 20 s) · Kauê · slide de título

*"Olá, professores. Eu sou o Kauê e, junto com o Gabriel, desenvolvemos o AgroHack: um sistema de gestão inteligente de insumos para propriedades rurais. Neste vídeo vamos mostrar o sistema funcionando de ponta a ponta: alertas, pareamento do operador, trabalho offline, sincronização com reanálise, aviso no WhatsApp e backup."*

### 🎬 CENA 2 — O problema (≈ 40 s) · Gabriel · câmera ou slide

*"Uma fazenda tem dezenas de insumos: fertilizantes, defensivos, sementes, combustível, peças. Na prática, o controle costuma ser em papel ou planilha, e duas perguntas ficam sem resposta: o que vai acabar, e quando? E onde está o dinheiro parado?"*

*"O resultado é a falta inesperada, como o trator parado sem diesel, ou o capital imobilizado em adubo que não vai ser usado tão cedo. O AgroHack transforma os registros de entrada e saída em alertas com justificativa, para o gestor decidir a tempo."*

### 🎬 CENA 3 — A solução (≈ 40 s) · Kauê · diagrama da arquitetura (README §3.1)

*"São três partes. Uma API central na nuvem, com PostgreSQL, que guarda os registros e reanalisa o estoque. Um app para Windows e um app para Android, feitos com o mesmo código em Tauri e Vue: o gestor normalmente usa o computador, e o operador de campo, o celular."*

*"E o diferencial: o app funciona offline. Cada aparelho tem um banco SQLite local. O que é lançado sem internet fica guardado e sobe para a nuvem quando a conexão volta, sem duplicar registros."*

### 🎬 CENA 4 — Painel do gestor (≈ 40 s) · Kauê · desktop

🖱️ App desktop já logado, na aba **Visão geral**.

*"Este é o painel do gestor. O login fica salvo no aparelho, então o app abre mesmo sem internet. Logo de cara aparecem os alertas prioritários, ordenados por urgência: urgentes primeiro, depois atenção e informativos."*

*"O motor de análise responde às perguntas do desafio: o que está acabando, o que pode vencer antes de ser usado, quanto se consome, se há retiradas fora do padrão, por quanto tempo o estoque dura e onde está o maior valor parado."*

### 🎬 CENA 5 — Alertas, justificativas e curva ABC (≈ 1 min 10 s) · Kauê · desktop

*"A organização não divulgou uma base oficial, então criamos uma base simulada, identificada como tal, com produtos das oito categorias do desafio e situações de falta, vencimento, consumo anômalo e capital parado."*

🖱️ Em **Alertas prioritários**, aponte o alerta da **Ureia**.

*"A Ureia está com alerta urgente: o saldo está no mínimo ou abaixo dele. E o sistema mostra a conta: consumo médio por dia, quantos dias de histórico usou e a autonomia estimada. Quando há poucas retiradas, ele avisa que a base é limitada; a previsão não é uma garantia."*

🖱️ Aponte o **Trichoderma**.

*"O Trichoderma tem risco de vencimento: no ritmo atual de uso, parte do estoque vence antes de ser consumida, e o sistema estima quanto sobra."*

🖱️ Aponte o **Diesel S10**.

*"No Diesel, uma retirada de 950 litros foi marcada como fora do padrão: é mais de três vezes a média das retiradas anteriores."*

🖱️ Abra a aba **Estoque** e role até **Estoque e curva ABC**; mostre também **Consumo ao longo do tempo**.

*"Na curva ABC aparece onde está o capital: o adubo MAP concentra o maior valor parado. Se um insumo não tem preço cadastrado, o valor fica como desconhecido, nunca como zero, e o total aparece como parcial. O gráfico mostra o consumo dos últimos 30 dias."*

### 🎬 CENA 6 — Pareamento do operador (≈ 50 s) · Gabriel · desktop + celular

🖱️ No desktop: botão **Conectar operador** → digite o nome (ex.: "João da Silva") → **Gerar código e QR Code**.

*"Agora o operador de campo. No painel do gestor, clico em Conectar operador, digito o nome e gero o código. Aparecem um QR Code e um código curto no formato AGRO seguido de quatro caracteres."*

🖱️ No celular: app aberto → **Conectar a uma fazenda** → **Ler com a câmera** → aponte para o QR do monitor.

*"No celular, escolho conectar a uma fazenda e leio o QR. Ao ler, o app já conecta sozinho, com a fazenda vinculada e o operador identificado."*

*"Se o celular não tiver câmera, dá para escolher uma imagem do QR ou digitar o código manual. O pareamento é o mesmo."*

### 🎬 CENA 7 — Registro offline (≈ 50 s) · Gabriel · celular

🖱️ Ative o **modo avião** no celular, mostrando o ícone.

*"Agora, sem internet nenhuma: modo avião, sem Wi-Fi e sem dados móveis."*

🖱️ No app do celular: **Baixa rápida** → Insumo **Diesel S10** → Quantidade **200** → Destino "Trator" → **Salvar neste aparelho**.

*"Registro uma retirada de 200 litros de diesel. O app confirma: salva neste aparelho, na fila de sincronização. Nada se perde, mesmo que o celular seja desligado."*

🖱️ **Baixa rápida** → Insumo **Ureia** → Quantidade **2** (sacas; precisa ser menor que o saldo anotado) → **Salvar neste aparelho**.

🖱️ Aponte o indicador no topo do app: **"2 registro(s) pendente(s)"**.

*"E mais uma retirada de duas sacas de Ureia. O topo do app mostra dois registros pendentes, feitos totalmente offline."*

### 🎬 CENA 8 — Sincronização e reanálise (≈ 1 min) · Kauê · desktop + celular

🖱️ Desative o **modo avião**. Se a sincronização não acontecer sozinha em alguns segundos, toque em **Sincronizar agora** no celular.

*"Agora reconecto o celular. O app envia os registros que estavam na fila para a nuvem. Cada registro tem um identificador único: se o envio se repetir, nada é duplicado."*

🖱️ No desktop: toque em **Sincronizar agora** (ou aguarde a sincronização automática) e mostre a aba **Histórico** com as duas movimentações do operador; depois volte a **Estoque**.

*"No computador do gestor, as movimentações do operador já aparecem no histórico, com autor, data e destino. E o estoque foi reanalisado: o saldo e a autonomia da Ureia caíram, porque a saída do campo entrou na conta. A reanálise acontece no app e no servidor, com as mesmas regras. É isso que o regulamento chama de atualização dos registros e reanálise."*

### 🎬 CENA 9 — Alerta no WhatsApp (≈ 40 s) · Gabriel · celular do gestor

🖱️ Mostre o WhatsApp do gestor recebendo a mensagem (pode levar alguns segundos depois da sincronização).

*"Quando a reanálise encontra um alerta urgente, o servidor manda um WhatsApp para o número do gestor, sem ninguém precisar abrir o app."*

*"O envio é feito pela Twilio. Como usamos a conta de testes, a Meta só permite modelos de mensagem pré-aprovados, então o texto que chega é o do modelo de teste. O detalhe do alerta, com produto, nível e motivo, está no app. Em produção, registraríamos um modelo próprio com o nome do insumo e o diagnóstico."*

### 🎬 CENA 10 — Backup e restauração (≈ 40 s) · Kauê · desktop

🖱️ Aba **Backups** → **Criar backup do dia** → mostre a lista → **Restaurar** no backup de hoje.

*"O app faz backup automático diário do banco local e guarda os últimos sete dias. O backup é gerado de forma atômica pelo próprio SQLite."*

*"Para restaurar, um clique. Antes de aplicar, o app guarda uma cópia do estado atual, por segurança. A restauração vale para o aparelho e não desfaz o que já está na nuvem."*

### 🎬 CENA 11 — Encerramento (≈ 30 s) · ambos · câmera frontal

**Gabriel:** *"Em resumo: o AgroHack funciona offline, sincroniza sem duplicar, reanalisa o estoque, avisa o gestor no WhatsApp e roda no Windows e no Android, com instaladores gerados automaticamente no GitHub."*

**Kauê:** *"O código, a documentação, os dados simulados e as limitações estão no README do repositório. Obrigado, professores."*

---

## 5. Plano B durante a gravação

| Problema | O que fazer |
|---|---|
| O WhatsApp não chegou em 1 a 2 minutos | Siga a gravação e mostre o alerta urgente no app. Depois confira: o SQL da seção 2.4 foi rodado? O `join twilio-trial` está ativo? As mensagens grátis acabaram? Dá para regravar só a Cena 9 depois de resolver os alertas de novo e registrar outra saída. |
| O celular não sincroniza ao sair do modo avião | Toque em **Sincronizar agora**. Confira se o celular voltou mesmo para a internet (Wi-Fi ou dados). |
| O QR não é lido | Use **Código manual** com o código mostrado no painel. |
| Saldo da Ureia insuficiente para a saída | Use uma quantidade menor, ou registre antes uma **Entrada de compra** de Ureia (fora da gravação). |
| A API não responde | Confira o deploy no Coolify. O app continua salvando offline; grave as cenas de desktop e repita o bloco C quando a API voltar. |

---

## 6. Depois da gravação

1. **Editar:** juntar as cenas na ordem, cortar silêncios e erros. O DaVinci Resolve é gratuito.
2. **Subir no YouTube** como **Não listado**.
   - Título sugerido: `AgroHack 2026 — Oliveira & Oliveira (AGRO26-F009CD2F9F) — Vídeo demonstrativo`
   - Descrição sugerida: `Demonstração do AgroHack: gestão inteligente de insumos rurais com alertas, funcionamento offline, sincronização com reanálise e aviso por WhatsApp. Repositório: https://github.com/GabrielOlisil/AgroHacka — Versão demonstrada: v1.0.1-entrega. Dados simulados criados pela equipe.`
   - Ative as legendas automáticas, se possível.
3. **Testar o link** numa janela anônima, para garantir que abre sem login.
4. **Enviar o link para a coordenação** até **22h (horário de Ariquemes)**.
5. **Colocar o link no README** (seção 6, Demonstração) e marcar o item 6 do checklist 7.1 e a tarefa 8.1 no `tarefas.md`.
