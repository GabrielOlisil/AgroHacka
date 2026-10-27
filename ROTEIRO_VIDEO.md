# 🎬 Roteiro — Vídeo Demonstrativo AgroHack 2026
**Equipe:** Oliveira & Oliveira | Gabriel de Oliveira Silva & Kauê Rian Silva Conceição Oliveira  
**Protocolo:** AGRO26-F009CD2F9F | Curso: ADS 6º Período — IFRO Campus Ariquemes  
**Gravação:** Captura de tela do Desktop + celular Android  
**Edição sugerida:** DaVinci Resolve (grátis) ou OBS Studio  

---

## 🗓️ Estrutura Geral das Cenas

| Cena | Conteúdo | Narrador | Tela/Câmera |
|------|----------|----------|-------------|
| 1 | Abertura e apresentação | Kauê | Slide de título |
| 2 | O problema rural | Gabriel | Slide / câmera |
| 3 | A solução AgroHack | Kauê | Diagrama da arquitetura |
| 4 | Demo: Painel do Gestor | Kauê | Captura de tela |
| 5 | Demo: Alertas e Curva ABC | Kauê | Captura de tela |
| 6 | Demo: Pareamento do Operador | Gabriel | Captura desktop + celular |
| 7 | Demo: Operador offline no celular | Gabriel | Câmera apontada pro celular |
| 8 | Demo: Sincronização e reanálise | Kauê | Captura desktop |
| 9 | Demo: Alerta no WhatsApp | Gabriel | Câmera no celular com WhatsApp |
| 10 | Demo: Backup e restauração | Kauê | Captura de tela |
| 11 | Encerramento | Ambos | Câmera frontal |

---

## 🎙️ ROTEIRO COMPLETO — PALAVRA POR PALAVRA

---

### 🎬 CENA 1 — Abertura (Slide de título na tela)

> **[Narrador: KAUÊ — câmera frontal ou voz off enquanto o slide aparece]**

*"Olá, professores. Eu sou o Kauê, e junto com o Gabriel, somos os desenvolvedores do AgroHack — sistema de gestão inteligente de insumos para propriedades rurais."*

*"Neste vídeo, vamos mostrar o software funcionando de ponta a ponta: desde o cadastro, passando pelo monitoramento de alertas, pareamento de dispositivos, trabalho totalmente offline, sincronização automática, notificação por WhatsApp e backup com restauração em um clique."*

*"Sem mais delongas, vamos direto à demonstração."*

---

### 🎬 CENA 2 — O Problema (câmera frontal ou slide simples)

> **[Narrador: GABRIEL]**

*"Imagina a seguinte situação: você gerencia uma fazenda com dezenas de insumos — herbicidas, fertilizantes, defensivos, combustível. Você sabe o que tem no galpão? Sabe quando vai acabar? Sabe se alguma coisa vai vencer antes de ser usada?"*

*"A realidade de muitos produtores rurais é essa: planilhas manuais, anotações em papel, ou pior — nenhum controle. E o resultado disso são dois problemas clássicos:"*

*"Primeiro: a falta inesperada. O trator para no meio da colheita porque o diesel acabou sem avisar ninguém."*

*"Segundo: dinheiro parado. Toneladas de adubo estocado além do necessário enquanto o caixa sangra."*

*"O AgroHack resolve exatamente isso — transformando registros simples de entrada e saída em inteligência agronômica real."*

---

### 🎬 CENA 3 — A Solução (diagrama de arquitetura na tela)

> **[Narrador: KAUÊ]**

*"A arquitetura do nosso sistema tem três pilares."*

*"Primeiro: uma API central hospedada em nuvem própria, com banco de dados PostgreSQL, que armazena tudo com segurança."*

*"Segundo: um aplicativo desktop para Windows e um aplicativo mobile para Android — ambos gerados do mesmo código, usando Tauri e Vue 3. Isso garante que o Gestor, que normalmente usa o computador, e o Operador de campo, que usa o celular, vejam a mesma informação com a mesma qualidade."*

*"Terceiro, e esse é nosso diferencial técnico: o sistema funciona cem por cento offline. Cada dispositivo tem um banco SQLite local, e tudo que é lançado sem internet fica guardado no aparelho e é enviado para a nuvem assim que a conexão volta, sem duplicar nada."*

*"Vamos ver tudo isso funcionando agora."*

---

### 🎬 CENA 4 — Painel do Gestor (captura de tela do desktop)

> **[Narrador: KAUÊ — mostrando a tela]**

*"Aqui estamos com o sistema aberto no computador do Gestor. O login é feito com e-mail e senha, e a sessão fica salva localmente — o sistema nunca te desloga mesmo sem internet."*

*"Após o login, você cai direto no painel principal. Olha o que aparece logo de cara: os alertas prioritários do estoque da fazenda."*

*"O sistema usa um motor de inteligência agronômica próprio — desenvolvido em TypeScript — que responde a sete perguntas fundamentais do regulamento do desafio: quando vai acabar, o que vai vencer antes de ser consumido, o que está sendo usado de forma anômala, o que está parado imobilizando capital, e qual é a curva de prioridade dos insumos."*

---

### 🎬 CENA 5 — Alertas Críticos e Curva ABC (captura de tela)

> **[Narrador: KAUÊ — rolando a tela e apontando para os alertas]**

*"Como a organização não divulgou uma base oficial, criamos uma base simulada, identificada como tal, com produtos das oito categorias do desafio e os quatro cenários: falta, vencimento, consumo anômalo e capital parado."*

*"Veja: alerta em vermelho — 'Ureia 45%'. Baseado no consumo recente, o estoque vai acabar em menos de três dias. A mensagem é clara: mantenha o consumo atual e o saldo será suficiente por apenas dois vírgula oito dias."*

*"Segundo alerta — 'Trichoderma asperellum'. Esse produto vai vencer antes de ser consumido. O sistema calcula a validade e projeta o consumo, e quando a validade chega antes do fim do estoque, emite o alerta."*

*"Terceiro: anomalia no 'Diesel S10'. Uma saída de novecentos e cinquenta litros — quando a média histórica era bem abaixo disso. O sistema detecta isso automaticamente usando estatística simples: qualquer saída acima de três vezes a média anterior acende o alerta."*

*"E na Curva ABC, você vê o que representa mais capital imobilizado. Aqui, o 'Adubo MAP' está com cento e quarenta e sete mil reais parados. O sistema classifica automaticamente os produtos em A, B e C por valor de estoque."*

*"Todos esses alertas são persistidos no banco central e enviados como notificação — daqui a pouco você vai ver isso no WhatsApp."*

---

### 🎬 CENA 6 — Pareamento do Operador (desktop + celular lado a lado)

> **[Narrador: GABRIEL — desktop mostrando o painel do Gestor]**

*"Agora vou mostrar como o Operador de campo se conecta à fazenda. É um processo pensado para ser rápido e funcionar mesmo sem conhecimento técnico."*

*"No painel do Gestor, clico em 'Conectar Operador'. Digito o nome do operador — aqui vou usar 'João da Silva'. O sistema gera automaticamente um QR Code e um código alfanumérico de seis caracteres — por exemplo, AGRO-88."*

*"Agora pego o celular."*

> **[Câmera aponta para o celular]**

*"No celular, o aplicativo foi aberto pela primeira vez. Aparecem duas opções: 'Criar Nova Fazenda' — para o Gestor — e 'Conectar a uma Fazenda Existente' — para o Operador."*

*"Toco em conectar. O app abre o leitor de QR Code. Aponto para a tela..."*

> **[Pausa para o QR ser lido]**

*"Pronto. Pareado. O nome do operador ficou registrado, a fazenda foi vinculada, e o Operador já tem acesso ao banco local sincronizado."*

*"Mas, e se o celular do operador não tiver câmera? Simples: na mesma tela, tem o botão 'Digitar Código Manualmente'. Ele digita AGRO-88 e o pareamento acontece da mesma forma."*

---

### 🎬 CENA 7 — Operador Offline no Celular (câmera no celular)

> **[Narrador: GABRIEL — câmera apontada para o celular]**

*"Agora vem um dos pontos mais importantes do sistema: ele funciona cem por cento offline."*

*"Vou ativar o modo avião aqui no celular. Sem Wi-Fi, sem dados móveis. Sem internet nenhuma."*

> **[Ativa modo avião]**

*"O app continua aberto. Estou no painel do Operador. Aqui o design é pensado para campo: botões grandes, textos claros, toque fácil mesmo com luva."*

*"Vou registrar uma baixa de insumo. Toco em 'Baixa Rápida'. Escolho o produto — Diesel S10. Coloco a quantidade: duzentos litros. Confirmo."*

*"A movimentação foi salva localmente no SQLite do celular — ela entrou na fila de sincronização, chamada de outbox. O sistema nunca perde essa informação. Quando a internet voltar, ela sobe automaticamente."*

*"Vou registrar mais uma saída de Ureia — trezentos quilos. Confirmo."*

*"Duas movimentações salvas, modo avião ligado, zero conexão. Isso é funcionamento offline de verdade."*

---

### 🎬 CENA 8 — Sincronização Automática e Reanálise (captura desktop)

> **[Narrador: KAUÊ — olhando para o desktop e desligando o modo avião no celular]**

*"Agora vou reconectar o celular à rede."*

> **[Desativa modo avião]**

*"Em segundos, o motor de sincronização entra em ação e envia para a nuvem tudo que ficou guardado no celular, sem duplicar nenhum registro."*

*"Olha o que acontece no desktop do Gestor..."*

> **[Aponta para os alertas na tela]**

*"As movimentações do Operador chegaram. E o sistema fez algo automático: rodou a reanálise completa do estoque. Aquele alerta da Ureia que estava em três dias? Agora mostra menos de um dia — porque a saída do Operador foi considerada."*

*"E mais: cada movimentação tem um UUID único. Isso garante que, mesmo que a sincronização seja repetida, os dados não são duplicados no banco. Idempotência, como chamamos na engenharia de software."*

---

### 🎬 CENA 9 — Alerta no WhatsApp (câmera no celular com WhatsApp aberto)

> **[Narrador: GABRIEL — câmera mostrando o celular com o WhatsApp]**

*"Quando um alerta atinge nível crítico — como a Ureia que está com menos de um dia de estoque — o sistema dispara automaticamente uma mensagem de WhatsApp para o número do Gestor cadastrado."*

*"Aqui está a mensagem chegando."*

> **[Câmera mostra a notificação do WhatsApp]**

*"A mensagem vem via Twilio, que é o serviço de comunicação que integramos. Ela diz o nome do produto, o nível de alerta e o motivo: quantos dias restam baseado no consumo recente."*

*"O Gestor não precisa estar com o app aberto. Não precisa lembrar de checar. O sistema avisa sozinho."*

---

### 🎬 CENA 10 — Backup Automático e Restauração (captura desktop)

> **[Narrador: KAUÊ — mostrando a tela de configurações]**

*"Mais um diferencial: o sistema faz backup automático diário do banco de dados local, no estilo do Anki — o famoso app de flashcards que muita gente usa para estudar."*

*"Vou em Configurações, depois em Backups."*

> **[Navega para a tela de backups]**

*"Aqui estão listados os snapshots dos últimos sete dias, com data, hora e tamanho. Cada backup é um arquivo SQLite completo, gerado com o comando VACUUM INTO — isso garante que o backup é atômico, sem risco de dados corrompidos."*

*"Se acontecer qualquer problema — falha no hardware, acidente, reinstalação — o Gestor clica em 'Restaurar' em qualquer um desses arquivos."*

*"O sistema verifica a integridade do backup antes de restaurar, cria um snapshot do estado atual — por segurança — e aplica o backup. Um clique. Sem técnico, sem suporte remoto."*

---

### 🎬 CENA 11 — Encerramento (câmera frontal — ambos)

> **[GABRIEL fala primeiro]**

*"É isso, professores. Em resumo: o AgroHack é um sistema que funciona offline, sincroniza de forma inteligente, alerta via WhatsApp e é empacotado tanto como aplicativo Windows quanto como APK Android — gerados automaticamente pelo nosso pipeline de CI/CD no GitHub Actions."*

> **[KAUÊ continua]**

*"Todo o código está disponível publicamente no repositório GitHub da equipe: github.com/GabrielOlisil/AgroHacka. O README tem instruções de instalação, download direto do executável e APK, e documentação completa das funcionalidades e limitações conhecidas."*

*"O protocolo de inscrição da nossa equipe é AGRO26-F009CD2F9F. Somos Gabriel e Kauê, do curso de Análise e Desenvolvimento de Sistemas do IFRO Campus Ariquemes."*

*"Muito obrigado pela atenção e pelo tempo de avaliação."*

> **[AMBOS acenam para a câmera]**

---

## 🎥 Orientações Técnicas de Gravação

### Software Recomendado
- **OBS Studio** (gratuito) para captura de tela + microfone simultaneamente
- **DaVinci Resolve** (gratuito) para edição e cortes

### Setup Ideal
1. **Resolução:** 1920×1080 (Full HD)
2. **Microfone:** Qualquer fone com microfone embutido funciona — evitar ruído de fundo
3. **Celular na tela:** Usar um suporte de celular, ou gravar o celular com a câmera do notebook enquanto a captura de tela roda em paralelo — editar as duas fontes depois
4. **Velocidade:** Narrar em ritmo confortável — o vídeo não tem limite de tempo

### Sequência de Gravação Sugerida
Para facilitar a edição, grave as cenas na seguinte ordem:
1. Grave primeiro **as cenas de captura de tela** (Cenas 4, 5, 8, 10) com o app rodando
2. Grave as **cenas com celular** (Cenas 6, 7, 9) separadamente
3. Grave por último as **cenas de câmera frontal** (Cenas 1, 2, 3, 11)
4. Na edição, monte na ordem do roteiro e corte os silêncios

### Legenda / Subtítulo
Se possível, adicionar **legendas automáticas** no YouTube após o upload — melhora a acessibilidade e a avaliação dos professores que assistirem sem som.

---

## 📌 Checklist Antes de Gravar

- [ ] API rodando na VPS (ou localmente para a demo)
- [ ] App desktop aberto e logado com a base simulada (`npm run seed` já executado)
- [ ] Celular com o APK instalado e pareado
- [ ] Twilio configurado e WhatsApp sandbox ativo
- [ ] Modo avião pronto para ser ativado/desativado no celular
- [ ] OBS configurado com captura de tela + microfone
- [ ] Roteiro impresso ou em segundo monitor

---

## 🔗 Após a Gravação

1. Fazer upload no **YouTube** como **"Não listado"** (o link funciona, mas não aparece nas buscas)
2. Copiar o link do vídeo
3. Atualizar o `README.md` na seção de Demonstração com o link
4. Fazer commit: `docs(readme): adicionar link do vídeo demonstrativo`
