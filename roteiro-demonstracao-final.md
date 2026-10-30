# Roteiro da demonstração ao vivo · Final de 30/10/2026

*Tarefa 12.2. Para Kauê e Gabriel. A demonstração ao vivo é obrigatória: slides e vídeos só apoiam. Pelas regras, durante a demonstração é permitido inserir dados e registrar movimentações; mudar o código, não.*

Tempo total: **até 10 minutos**, mais 3 de perguntas. O cronômetro não para se algo nosso falhar.

---

## 1. Estrutura dos 10 minutos

| Tempo | Parte | Quem | Como |
|---|---|---|---|
| 0:00–2:30 | Slides: capa, problema, critérios dos alertas, como o gestor decide, limitações | Alternado, começando por Kauê | Slides |
| 2:30–6:30 | **Demonstração ao vivo** (seção 3) | Alternado: quem fala narra e o outro opera o notebook | Notebook, app instalado |
| 6:30–7:50 | Vídeos de apoio: celular sem internet, QR Code e WhatsApp | Alternado | Vídeos no deck |
| 7:50–8:20 | Encerramento | Os dois | Slide final |
| 8:20–10:00 | **Folga** para imprevistos | — | — |

A folga de 1:40 é proposital. Se tudo correr bem, a demonstração pode se estender com o passo opcional 3.7 (offline ao vivo).

---

## 2. Antes da apresentação

### Na manhã de 30/10
- [ ] Instalar no notebook a **versão avaliada, 1.1.7** (README, seção 10), por cima da anterior e sem desinstalar.
- [ ] Entrar como gestor com a conta da apresentação, **agro@agrohack.com** (senha fora do repositório). Ela foi criada em 30/10 com o cenário de 28/10 trazido para hoje, então os números do roteiro valem até a noite. **Ninguém registra nada nela antes da apresentação.** Para ensaiar, usar **ensaio@agrohack.com**, que é uma cópia idêntica.
- [ ] **Conferir, só olhando, os insumos usados na seção 3** (números conferidos em 30/10 na conta agro@agrohack.com):
  - **Bicos de Pulverização:** 45 un e mínimo de 15 un, com um alerta de **atenção** (dura cerca de 9 dias). A saída ao vivo o faz subir para **urgente**.
  - **Óleo Lubrificante 15W-40:** confirmar que está com saldo 0 e alerta urgente de falta.
  - **Trichoderma:** aparece como **vencido** em 29/10 (urgente). Vale citar na hora.
- O WhatsApp **não** é mostrado ao vivo: ele aparece no vídeo de apoio (6:30–7:50), junto com o celular sem internet e o QR Code. Não é preciso mandar o `join` da Twilio.

### No CEI, antes das 19h15 (os dois presentes, ou a equipe é desclassificada)
- [ ] Notebook carregado, com carregador e adaptador HDMI testados no projetor.
- [ ] App aberto e logado, zoom de 125% (Ctrl e +), notificações do Windows desligadas e outras janelas fechadas.
- [ ] Deck de slides aberto em outra janela, com os vídeos funcionando.
- [ ] Internet testada; o roteador do celular fica como reserva.
- [ ] Os vídeos soltos também num pendrive (plano B).

---

## 3. Demonstração ao vivo, passo a passo (cerca de 4 minutos)

O que se diz está entre aspas. **Quem fala não opera:** o outro clica, para a fala não travar.

### 3.1 Visão geral: o gestor abre o app (cerca de 40 s)
- **Mostrar:** o resumo no topo e os alertas em ordem: urgentes primeiro e, dentro de cada nível, o mais grave primeiro.
- **Ler um alerta urgente até o fim**, de preferência o da Ureia, que tem bons dados.
- **Fala:** "Este é o painel do gestor. Os alertas vêm do mais grave para o menos grave, e cada um mostra a conta e termina dizendo o que fazer. Aqui: comprar cerca de tantas sacas, por tantos reais, para 30 dias de uso."

### 3.2 Por que confiar no alerta: tela "Como funciona" (cerca de 20 s)
- **Mostrar:** a regra de cada alerta e o limiar.
- **Fala:** "Cada regra está explicada aqui, com o limiar usado. Nada é caixa-preta."

### 3.3 Estoque: aprofundar (cerca de 30 s)
- **Mostrar:** o filtro "abaixo do mínimo" e as colunas de duração, valor, curva ABC e validade.
- **Fala:** "Na aba Estoque o gestor vê quanto dura cada insumo, quanto dinheiro está parado e a curva ABC."

### 3.4 Registro ao vivo que **cria** um alerta (cerca de 60 s) · o momento principal
- **Operar:** Visão geral → Movimente seu estoque → Baixa rápida → **Bicos de Pulverização** → saída que deixe o saldo **igual ao mínimo**. Na conta da apresentação, 30 un (45 − 15). Data: agora → Salvar.
- **Mostrar:** o "o que mudou" e o alerta dos Bicos, que passa de atenção para **urgente**, com "O que fazer: comprar cerca de …".
- **Fala:** "Agora uma retirada real, ao vivo: 30 bicos. O saldo chegou ao mínimo, o estoque foi recalculado na hora e o alerta dos bicos subiu para urgente, já dizendo quanto comprar."

### 3.5 Registro ao vivo que **resolve** um alerta (cerca de 40 s)
- **Operar:** Estoque → **Óleo Lubrificante 15W-40** → Entrada de **100 L** → Salvar.
- **Mostrar:** o alerta urgente de falta do óleo **some**, e aparece em "o que mudou" como resolvido.
- **Fala:** "E o caminho contrário: chegou a compra de óleo. Registramos a entrada, e o alerta de falta foi resolvido sozinho."

### 3.6 Histórico (cerca de 20 s)
- **Mostrar:** os dois registros que acabamos de fazer, com quem registrou e a etiqueta "Enviado".
- **Fala:** "Tudo fica no histórico, com quem registrou e quando."

### 3.7 Opcional · offline ao vivo no notebook (cerca de 40 s; só com folga de tempo e internet estável)
- **Operar:**
  1. Desligar o Wi-Fi do notebook.
  2. Registrar uma saída pequena, por exemplo 1 un de Bicos.
  3. Mostrar "Sem internet" e "Esperando envio".
  4. Religar o Wi-Fi e tocar em Atualizar agora; deve aparecer "Enviado".
- **Fala:** "Sem internet, o registro fica salvo no aparelho e a análise continua funcionando. Quando a conexão volta, ele é enviado uma única vez."
- Se der errado, **não insistir**: passar ao vídeo do celular sem internet.

---

## 4. Vídeos de apoio (cerca de 1:30)

| Vídeo | Mostra | Por que em vídeo |
|---|---|---|
| Celular sem internet | Modo avião → "Esperando envio" → "Enviado" no computador | Precisa de dois aparelhos ao mesmo tempo |
| QR Code | O gestor gera o QR Code e o celular do operador conecta | Exige celular e câmera |
| Registro + WhatsApp | A saída gera um urgente e a mensagem chega | Depende da Twilio, que pode falhar na hora |

Os vídeos foram gravados antes das melhorias da Etapa 12. **Se alguma tela mudar visivelmente, regravar ou avisar na fala** (tarefa 12.21).

---

## 5. Planos B

| Problema | O que fazer |
|---|---|
| Sem internet no CEI | O app funciona offline: os passos 3.1 a 3.6 rodam com a análise do próprio aparelho. Falar: "estamos sem internet, e é exatamente para isso que o app foi feito". |
| A API publicada fora do ar | Mesmo caso: o app analisa localmente. Os registros ficam esperando envio. |
| O notebook não liga ou não conecta ao projetor | Apresentar pelo deck em outro computador e usar os vídeos como demonstração. Avisar a banca, sem perder tempo tentando consertar. |
| O alerta esperado não aparece | Mostrar o alerta que existir e explicar a conta dele. Nunca forçar dados na frente da banca. |
| Perguntarem pelo WhatsApp | O vídeo 3 mostra a mensagem; ao vivo ele não é mostrado. |

---

## 6. Ensaio (tarefa 12.15)
- Fazer pelo menos **duas passadas completas com cronômetro**, com o notebook e os dados reais.
- Ensaiar à vontade na conta **ensaio@agrohack.com**, inclusive a saída dos Bicos e a entrada do Óleo. **Nunca** registrar nada na **agro@agrohack.com** antes da apresentação.
- Combinar quem opera e quem fala em cada passo, para alternar sem perder tempo.
