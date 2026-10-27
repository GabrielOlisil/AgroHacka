# Aceite offline no Android — tarefa 5.2 (DEV 2)

Status em 26/10/2026: **pendente de execução no aparelho**, adiado pelo usuário.
Este roteiro não é evidência de teste concluído. A sincronização do MVP é somente
pela nuvem; o mesmo Wi-Fi, sem internet, não sincroniza celular e computador.

## Preparação

- Use uma fazenda de demonstração autorizada e um operador pareado nela. Não
  invente movimentações no estoque real para testar nem compartilhe credenciais.
- Registre a versão/release do APK, o modelo e a versão do Android. Não reinstale,
  limpe dados nem restaure um backup se houver pendências no aparelho.
- Com internet, sincronize o celular e o gestor da mesma fazenda. Confirme que não
  existem pendências ou recusas anteriores que confundam a conferência.
- Escolha um insumo com saldo conhecido `S` e uma quantidade de saída `q`, positiva
  e menor ou igual a `S`, na mesma unidade. Anote `S`, `q`, o responsável e o horário.

## Execução e resultado esperado

1. Ative modo avião e confirme que Wi-Fi e dados móveis estão desligados.
2. No celular, salve **uma** saída de `q`, com observação identificável, por exemplo
   `TESTE-OFFLINE-<data-hora>`. Aguarde a confirmação de salvamento local.
   - O saldo provisório deve ser `S - q`, com uma pendência a mais.
   - O saldo confirmado conhecido ainda deve ser `S`; os alertas locais recalculam.
3. Toque em **Sincronizar agora** sem internet.
   - Deve haver aviso de falha, mantendo a sessão, o registro e a pendência.
   - Não registre novamente a saída só porque o envio falhou.
4. Feche e reabra o aplicativo, ainda sem internet, sem limpar dados.
   - A sessão, o histórico com uma única saída e a pendência devem reaparecer.
   - O saldo provisório deve continuar em `S - q`.
5. Desative modo avião, recupere uma conexão com internet e mantenha o app aberto.
   Aguarde a sincronização ou use **Sincronizar agora**.
   - A pendência desse registro deve zerar após confirmação da nuvem.
   - O saldo confirmado e o provisório devem convergir para `S - q`, desde que
     nenhum outro aparelho tenha lançado movimentações nesse intervalo.
   - Uma recusa deve aparecer para revisão; não conta como aprovação do teste.
6. Sincronize o gestor e confira a mesma saída, quantidade, unidade e responsável
   no histórico da fazenda de demonstração.
7. Sincronize novamente os dois aparelhos e reabra o celular.
   - A saída continua aparecendo uma única vez, sem novo débito e sem pendência.

## Registro do aceite

Preencher depois da execução, sem tokens, QR Codes, códigos de pareamento ou
dados pessoais em capturas de tela:

| Evidência | Resultado observado |
| --- | --- |
| APK/release e data do teste | Não executado |
| Aparelho e Android | Não executado |
| Saldo inicial, quantidade/unidade e saldo final | Não executado |
| Persistência após fechar e reabrir offline | Não executado |
| Confirmação no gestor após reconexão | Não executado |
| Nova sincronização sem duplicidade | Não executado |

Somente após esses critérios passarem, concluir o checkbox de validação física e
a tarefa 5.2 em `../tarefas.md`. Se falhar, anotar em qual etapa, o aviso exibido e
a contagem de pendências; preservar o app e o SQLite para diagnóstico. Não apagar
banco, editar migrations nem tentar corrigir o resultado diretamente na nuvem.

## O que os testes automatizados comprovam

Em `client/`, `npm test` cobre a interface, regras, transações SQLite, recibos,
reenvios e convergência com servidor simulado. `npm run check` verifica tipos e
`npm run build` compila a interface. Em `client/src-tauri/`,
`cargo test --locked --test storage` valida transações e recuperação em bancos
temporários. Nenhum desses comandos substitui o ciclo físico acima nem é prova
isolada de concorrência PostgreSQL ou de entrega de WhatsApp em produção.
