# Paiol — preparação da sabatina

Material das tarefas 12.16 e 12.21, conferido com código, README e tarefas em 30/10/2026. Versão de referência: 1.1.8 (mesmas funcionalidades da 1.1.6, com revisão documental e o roteiro da apresentação). O roteiro vigente é [`roteiro-apresentacao-banca.md`](roteiro-apresentacao-banca.md). Gabriel e Kauê devem estudar todas as respostas. Divisão sugerida: Gabriel apresenta telas e offline; Kauê detalha motor, autenticação e banco; qualquer um deve conseguir responder ao núcleo de cada pergunta.

As perguntas abaixo são uma preparação temática. O texto original das perguntas 21–25 do parecer e o baralho Anki da equipe não estão no workspace, portanto este material não afirma reproduzi-los nem atualiza o baralho externo.

## Perguntas e respostas curtas para treino

1. **Qual problema vocês resolvem e para quem?** Para o gestor rural, transformamos entradas e saídas em prioridades de compra, uso antes do vencimento e conferência de retiradas. Para o operador, permitimos registrar no celular mesmo sem internet.

2. **A fazenda de demonstração funciona na API publicada?** O usuário confirmou o notebook instalado e sincronizado. A release v1.1.8 está pública. Os vídeos da apresentação foram gravados na conta ensaio@agrohack.com, cópia da fazenda de demonstração, e a agro@agrohack.com fica de reserva. As credenciais antigas da carga foram revogadas em produção, conforme a 12.3; a demonstração usa a sessão autorizada já preparada, sem projetar senha ou tokens. Não informar que um login novo foi testado agora pelo agente.

3. **Onde está a reanálise de verdade?** Ao salvar, o aplicativo analisa os registros locais e mostra alertas novos, resolvidos e com mudança de nível. A API também reanalisa depois de aceitar movimentações. Nos vídeos, a saída de 30 bicos faz o alerta subir para urgente e a entrada de 100 L de óleo resolve a falta, e as duas ficam no histórico.

4. **Como a previsão é calculada?** Saídas dos últimos 30 dias divididas pelos dias de calendário desde a primeira retirada da janela, incluindo dias sem uso. O saldo dividido por esse uso diário dá a duração estimada. Sem consumo recente suficiente, a tela explicita os limites; não é uma previsão de clima, safra ou sazonalidade.

5. **Como sabem quanto comprar?** A meta é o maior entre o mínimo configurado e 30 dias do uso médio. Subtraímos o saldo não negativo e arredondamos para cima. O preço permite uma estimativa de custo; preço ausente continua desconhecido. Não é uma ordem automática de compra.

6. **Por que 7, 15, 30 e 90 dias, 3 vezes a média e 50%?** São parâmetros definidos pela equipe para o protótipo, documentados e testáveis. Não foram calibrados com produtores nem derivados de referência agronômica publicada. O próximo passo é ajustá-los com Agronomia, cultura e época do ano.

7. **Uma retirada fora do padrão prova desvio?** Não. Cada retirada com pelo menos três anteriores na janela de 30 dias é comparada à média das anteriores. A partir de três vezes a média, o sistema pede conferência e aponta a retirada de maior múltiplo. Pode ser uma operação legítima.

8. **Como detectam consumo crescente?** Comparamos uso por dia nos últimos 15 dias com a metade anterior, exigindo pelo menos duas retiradas em cada metade. A base anterior começa na primeira retirada; aumento de pelo menos 50% gera atenção. Isso não modela sazonalidade.

9. **O que funciona sem internet?** O aparelho já configurado mantém sessão, catálogo, registros, análise e cópias locais. Movimentações ficam na fila e são enviadas quando houver conexão. Login novo, pareamento e administração do catálogo precisam da API; dois aparelhos sem internet não trocam registros entre si.

10. **O que impede duplicar no reenvio?** A mesma movimentação mantém o UUID. Reenviar o mesmo identificador e conteúdo repete o resultado; mudar o conteúdo com o mesmo identificador é conflito. Duas pessoas registrando o mesmo fato com UUIDs diferentes é outro problema: sem referência compartilhada, o sistema não pode afirmar que uma delas é duplicata.

11. **E se dois operadores retirarem juntos mais que o estoque?** Offline, cada aparelho conhece um saldo anterior e não há reserva global. Preservamos os fatos e sinalizamos a divergência para o gestor. Não descartamos a saída nem inventamos uma entrada para esconder saldo negativo.

12. **Como tratam cadastros duplicados?** Cadastro e renomeação recusam nome equivalente de outro insumo, ignorando maiúsculas, acentos, espaços e símbolos; a API valida sob o lock da fazenda. Desativados também contam. Duplicados antigos geram alerta para revisão. Nomes apenas parecidos não são unidos automaticamente.

13. **É possível corrigir ou retirar um insumo do uso?** O gestor edita e desativa/reativa; a unidade não muda depois da primeira movimentação. Excluir é lógico e só é permitido sem movimentações; com histórico, desativa-se. Um aparelho offline pode registrar sobre catálogo antigo: retirada de desativado é aceita, e de excluído vai para revisão.

14. **Importam uma planilha nova pela interface?** Não nesta versão. Temos cadastro pelo gestor e uma carga simulada reproduzível e não destrutiva para ambiente autorizado. Um importador com mapeamento, validação e relatório é evolução futura; não dizer que existe um botão de importação.

15. **Controlam lote, validade e preço por compra?** Nesta versão, são dados do produto. Não há um razão de lotes por entrada, custo médio histórico ou estratégia FEFO por lote. Compras do mesmo produto com preços e validades diferentes exigem uma evolução do modelo; a tela não resolve isso hoje.

16. **Podem entrar vários gestores na mesma fazenda?** O fluxo atual não oferece convite ou vínculo de vários gestores na mesma fazenda. Administrador, consulta e recuperação de senha ficaram fora do fechamento da final. O cenário preparado usa um gestor e operadores pareados.

17. **Os dados são reais e houve validação com produtor?** Não: a organização não forneceu base oficial, então criamos cenários simulados das oito categorias. A validação foi técnica, com gabarito, paridade API/app e testes offline em aparelho. Retorno de produtor ou Agronomia não foi realizado; isso está explícito como limite.

18. **Qual é a evidência de que os alertas fazem sentido?** O gabarito usa o motor real, data fixa e resultados esperados para cenários plantados; produtos normais não devem gerar alerta. A paridade compara cliente e API com a mesma entrada. Isso comprova os cenários testados, não adequação agronômica universal. Antes de citar um total de testes, conferir a execução da versão apresentada.

19. **O WhatsApp sempre chega e tem o diagnóstico completo?** Depende de internet, configuração e serviço externo. Na conta de testes usamos o modelo permitido pela Twilio; o diagnóstico completo está no app. Só urgentes são enviados. Um alerta aberto não é reenviado a cada movimentação; voltar a ocorrer ou subir para urgente segue seu ciclo de notificação.

20. **Backup desfaz o estoque da nuvem?** Não. A cópia restaura o aparelho e cria uma recuperação do estado anterior. Não é um desfazer global e não substitui sincronização. Não restaurar uma base antiga no meio da apresentação para apagar registros já enviados.

21. **Como foi usada IA e quem responde pelo código?** Claude Code, Codex/ChatGPT e Gemini auxiliaram código, testes, revisão e documentação. As decisões e a responsabilidade são dos dois integrantes. O README registra a revisão humana por área. Não há modelo de IA gerando o diagnóstico de estoque em tempo de execução: as regras são explícitas.

22. **Qual é o diferencial?** Registro nativo no celular sem internet, persistência local, consolidação com outros aparelhos e análise que mostra motivo e ação. Não afirmar que nenhuma concorrente tem isso; explicar e demonstrar o que o Paiol efetivamente entrega.

## Treino e conferência final

- [ ] Cada integrante responde às perguntas sem ler, em cerca de 20–30 segundos por resposta.
- [ ] Comparar este material com o parecer original e preencher qualquer pergunta 21–25 não coberta.
- [ ] Atualizar o Anki da equipe, se for usado; o baralho externo não foi modificado pelo agente.
- [ ] Ensaiar três perguntas seguidas com tempo total de 3 minutos.
- [ ] Conferir slides: nome Paiol; tag v1.1.8; dados simulados; ação e reanálise; parâmetros da equipe; limites e IA.
- [ ] Vídeo de 28/10 identificado como versão 1.0.4; preferir mostrar ao vivo as melhorias da 1.1.6.
- [ ] Conferir números da fala contra o app atual. O gabarito fixo não representa automaticamente a fazenda publicada de hoje.

Referências: `README.md` §§5–10, `tarefas.md` Etapa 12, `roteiro-apresentacao-banca.md`, `client/src/alert-changes.ts`, `client/src/offline/analysis.ts` e testes de paridade/gabarito. A revisão dos slides externos e o ensaio entre os integrantes continuam pendentes.
