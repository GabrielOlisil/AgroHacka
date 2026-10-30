# Paiol — demonstração ao vivo da final

> Preparação anterior da 1.1.6, preservada como apoio técnico e ficha de evidências. O roteiro vigente da **1.1.7** é [`roteiro-demonstracao-final.md`](roteiro-demonstracao-final.md), com conta de ensaio e conta da apresentação separadas. Seguir os cenários e o cronograma desse roteiro; não executar a reposição alternativa abaixo na conta reservada da apresentação. O aceite de instalação registrado aqui é da 1.1.6.

Preparação das tarefas 12.2, 12.15 e 12.21, em 30/10/2026.
Versão: [v1.1.6](https://github.com/GabrielOlisil/AgroHacka/releases/tag/v1.1.6).
Final: 30/10 às 19h15, Auditório do CEI. Apresentação de até 10 minutos, mais 3 de perguntas.

## Estado da preparação

- [x] Gabriel confirmou que a v1.1.6 foi informada à organização.
- [x] Gabriel confirmou notebook com o app instalado e fazenda de demonstração sincronizada.
- [x] Release conferida: Windows .exe/.msi, app-portable.exe, Android agrohacka_1.1.6_arm64-debug.apk e Linux AppImage.
- [x] Roteiro abaixo conferido com o código da interface e os testes existentes.
- [ ] Ensaiar o roteiro completo no notebook e no celular que irão à final.
- [ ] Anotar os saldos atuais, a quantidade escolhida e o resultado real do ensaio.
- [ ] Conferir projeção, legibilidade, carregador, adaptador e internet alternativa.
- [ ] Guardar slides e vídeos localmente e testar a reprodução sem internet.

Os aceites de instalação e sincronização foram informados pelo usuário; não houve operação remota do notebook pelo agente. O roteiro ainda exige o ensaio físico.

## Divisão de tempo e fala

| Tempo acumulado | Responsável sugerido | Mostrar e dizer |
| --- | --- | --- |
| 0:00–0:45 | Gabriel | Problema: falta que para o trabalho, vencimento e dinheiro parado. Público: gestor e operador. |
| 0:45–1:20 | Kauê | Paiol: SQLite no aparelho, API e PostgreSQL; registros continuam sem internet. Dados da demonstração são simulados. |
| 1:20–2:40 | Kauê | Resumo do gestor; Ureia e ação de compra; Trichoderma e validade; Diesel e retirada fora do padrão; MAP e capital parado. |
| 2:40–4:10 | Gabriel | Celular em modo avião: uma saída identificada; saldo local e pendência. Reabrir se já ensaiado. |
| 4:10–5:00 | Gabriel | Reconectar, sincronizar o celular e depois o notebook; conferir uma única saída no Histórico. |
| 5:00–6:20 | Kauê | Reposição de Ureia no notebook: saldo antes/depois e quadro “O que mudou na análise” com alerta resolvido. |
| 6:20–7:00 | Gabriel | “Como funciona”: limites, origem dos números e base limitada. Mostrar o WhatsApp apenas se já chegou. |
| 7:00–8:00 | Ambos | Evidências de teste, limitações e próximos passos. Fechar com a decisão apoiada pelo app. |

Meta de ensaio: 8 minutos; os 2 minutos restantes são margem para navegação e rede. A duração não foi medida pelo agente. Se a rede atrasar, seguir o plano B sem consumir toda a margem.

## Antes de abrir a apresentação

1. Conferir o rodapé: versão 1.1.6. Usar os pacotes da tag fixa, não o link variável “latest”.
2. Abrir a fazenda de demonstração já autenticada nos aparelhos. Não depender de digitar senha, QR ou código na frente da banca. Não projetar credenciais.
3. Sincronizar e conferir que não há pendências antigas ou registros em revisão. Combinar que ninguém faça lançamentos paralelos durante o ensaio.
4. Anotar os valores atuais da Ureia: saldo, mínimo, consumo diário e recomendação. Conferir se ela ainda tem alerta de falta e retiradas recentes.
5. Separar uma quantidade positiva de saída, menor ou igual ao saldo disponível. Usar 2 sc apenas se o saldo permitir. Manter a unidade sc; não converter para kg.
6. Preparar a observação `DEMO-FINAL-30-10-HHMM`, com o horário do ensaio. Cada repetição é um fato novo; não reenviar criando outro lançamento se a internet demorar.
7. Conferir os alertas e os dados simulados na tela. Datas e retiradas da fazenda publicada podem ter mudado desde a carga: não prometer exatamente 7 alertas ou um valor fixo de autonomia.
8. Se o WhatsApp fizer parte da fala, testar antes com a conta autorizada. O núcleo da demonstração é a reanálise no aplicativo.

Não executar seed, SQL, exclusões, restauração de backup ou alteração do relógio para preparar a apresentação. A movimentação demonstrativa deve ocorrer apenas na fazenda simulada autorizada.

## Cena 1 — o diagnóstico leva a uma decisão

Na Visão geral do gestor, mostrar o resumo e abrir o alerta da Ureia. Ler o saldo, a janela e a recomendação que estão na tela.

Fala sugerida: “O gestor não precisa procurar em todos os registros. Aqui ele vê o que merece atenção e quanto o sistema sugere repor. É uma estimativa baseada no consumo recente, com a conta e os limites expostos.”

Mostrar rapidamente o vencimento do Trichoderma, a retirada fora do padrão do Diesel e o MAP na aba Estoque. Apontar justificativa e ação, sem ler todos os textos.

Os valores do teste-gabarito são exemplos de uma data fixa, não uma leitura atual da fazenda publicada: Ureia com 15 sc, mínimo de 40 sc e recomendação de 127 sc; MAP com R$ 147.000; Diesel com retirada de 950 L, 15,8 vezes a média anterior. Usar esses números na fala somente se corresponderem à tela.

## Cena 2 — retirada offline e confirmação em outro aparelho

1. No celular, ativar modo avião e garantir que Wi-Fi e dados móveis estejam desligados.
2. No Estoque, localizar a Ureia e tocar na ação de saída. Informar a quantidade escolhida e a observação do ensaio; salvar uma única vez em “Salvar neste aparelho”.
3. Mostrar que o saldo local caiu pela quantidade e que existe uma pendência de envio. O notebook ainda não deve ser apresentado como atualizado.
4. Se o fechamento/reabertura estiver ensaiado, reabrir sem limpar os dados: registro e pendência permanecem.
5. Reativar a internet. Aguardar o envio ou usar a ação de sincronização. Não criar a mesma saída novamente se o envio demorar.
6. Sincronizar o notebook. No Histórico, buscar a observação e conferir produto, quantidade e responsável uma única vez.
7. Repetir a sincronização, sem novo lançamento: saldo e quantidade de registros devem permanecer iguais.

Fala sugerida: “Salvar no aparelho acontece antes do envio. O outro aparelho só recebe depois que a API confirma e ele sincroniza. Repetir o envio preserva o identificador e não aplica a mesma saída duas vezes.”

Se aparecer recusa ou revisão, explicar o estado real e usar o plano B; isso não conta como envio aprovado.

## Cena 3 — atualização e reanálise visível

Retirar um pouco de um produto que já está urgente pode mudar apenas o saldo e a duração. O quadro “O que mudou” compara alertas novos, resolvidos ou com outro nível; nesse caso ele pode dizer que nenhum alerta mudou.

Para mostrar uma resolução clara:

1. Depois de receber a saída do celular, abrir a Ureia no Estoque do notebook. Anotar saldo `S`, mínimo `M` e uso diário `C` atuais.
2. Se houver consumo recente, calcular uma reposição `Q = máximo(1, teto(máximo(M, 30 × C)) + 1 − S)`, na unidade do produto. A unidade extra deixa o saldo acima do mínimo inclusive nos casos de igualdade. Não usar essa fórmula para inventar consumo quando não há histórico.
3. Conferir se a quantidade é plausível para a demonstração simulada e ler a ação recomendada na tela. Se o cenário estiver diferente, escolher outro produto com alerta de falta e histórico recente e ensaiar antes.
4. Tocar em “Entrada”, informar `Q`, observação `DEMO-REPOSICAO-30-10-HHMM` e salvar uma vez.
5. Antes de navegar ou fazer outra ação, mostrar “O que mudou na análise”: o alerta de falta deve aparecer como resolvido. Mostrar o novo saldo `S + Q` e a nova duração.
6. Sincronizar e conferir o registro no histórico. A conta local não depende de esperar a resposta da rede.

Fala sugerida: “Aqui a recomendação virou uma ação do gestor. Registrei a reposição e o aplicativo recalculou na hora: a falta foi resolvida. O histórico preserva a retirada e a compra; ele não troca o saldo antigo por um número sem origem.”

Exemplo apenas para treino: se `S = 13`, `M = 40` e `C = 85/18`, a fórmula dá `Q = 130 sc` e saldo final `143 sc`. Usar os valores reais da tela no palco. Outras condições podem manter outros alertas; resolver a falta não significa zerar todos os riscos.

## Plano B

| Problema | Continuação |
| --- | --- |
| Sem internet | Mostrar registro e reanálise locais no notebook já autenticado; manter a fila. Explicar que a atualização entre aparelhos espera a internet. |
| Celular ou QR falhou | Continuar a demonstração no notebook. O pareamento ao vivo é opcional; o aparelho pode começar pareado. |
| WhatsApp não chegou | Mostrar o alerta no app e explicar a dependência externa/Twilio de teste. Não prometer novo envio para um alerta que já estava aberto. |
| Alerta não mudou | Conferir se mudou apenas a conta. Voltar ao diagnóstico e explicar o resultado observado; não repetir entradas para forçar uma resolução. |
| Dados já alterados pelo ensaio | Ler o novo saldo e recalcular a quantidade. Não usar os números antigos. |
| Notebook falhou | Usar vídeo local já testado. Identificar que o vídeo de 28/10 mostra a 1.0.4; não apresentá-lo como gravação da 1.1.6. |

## Evidência do ensaio a preencher

| Campo | Registro |
| --- | --- |
| Versão / tag | 1.1.6 / v1.1.6 |
| Notebook e celular | A preencher pela equipe |
| Saldo inicial / saída / saldo após saída | A preencher |
| Observação da saída / uma ocorrência no histórico | A preencher |
| Pendências antes / offline / após envio | A preencher |
| Saldo antes da reposição / quantidade / saldo final | A preencher |
| Alerta resolvido exibido | A preencher |
| Tempo total do ensaio | A preencher |
| Internet alternativa e reprodução local dos vídeos | A preencher |

Base técnica conferida em 30/10: 21 testes do cliente (`alert-changes`, `alert-summary`, `manager-stock`) e 28 da API (`official-seed`, `parity`) passaram. Esses testes não substituem o ensaio físico e não comprovam uma entrega nova de WhatsApp.
