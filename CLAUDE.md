# 🧪 Diretrizes de Desenvolvimento — TDD, Gestão de Tarefas & Git

Neste projeto, você DEVE seguir rigorosamente a metodologia de **Desenvolvimento Orientado a Testes (TDD)**, a **Gestão Ativa de Tarefas** e as **Boas Práticas de Fluxo Git**.

---

## 🔁 1. O Ciclo Red-Green-Refactor é Mandatório

A cada nova funcionalidade ou correção de bug, execute os seguintes passos sem pular etapas:

1. **🔴 RED (Escrever o teste que falha):**
   - Antes de escrever ou alterar qualquer linha de código de implementação, crie o arquivo de teste correspondente (usando **Vitest** ou **Jest**).
   - O teste deve definir o comportamento esperado, entradas, saídas esperadas e casos de borda (edge cases).
   - **Execute o teste** no terminal e confirme que ele falha (e que a falha ocorre pelo motivo correto: classe/função ainda inexistente ou comportamento ainda não implementado).

2. **🟢 GREEN (Fazer o teste passar):**
   - Escreva estritamente a quantidade mínima de código necessária para fazer o teste passar.
   - Não adicione lógicas extras, antecipações desnecessárias ou código não testado neste estágio.
   - **Execute o teste novamente** e comprove que ele passou com sucesso.

3. **🟡 REFACTOR (Melhorar o código):**
   - Limpe duplicações, melhore a nomenclatura, aprimore a tipagem TypeScript e otimize a estrutura do código.
   - **Re-execute todos os testes** para garantir que a refatoração não causou regressões.

---

## 📋 2. Gestão Ativa do Checklist de Tarefas (`tarefas.md`)

- **Consulta Contínua:** Antes de iniciar qualquer trabalho, verifique qual é a próxima tarefa pendente em `AgroHacka/tarefas.md`.
- **Atualização Imediata:** Assim que uma tarefa ou subtarefa for concluída, testada e validada, marque o checkbox correspondente de `- [ ]` para `- [x]` no arquivo `AgroHacka/tarefas.md`.
- **Transparência:** Sempre informe ao usuário qual tarefa da lista está sendo executada no momento e reporte a atualização do checklist ao finalizá-la.

---

## 🌿 3. Fluxo de Branches & Pull Requests (Obrigatório)

Todo desenvolvimento DEVE seguir o fluxo de branches abaixo. **É proibido commitar diretamente em `main` ou `dev`.**

### 3.1 Nomenclatura de Branches

Use o padrão `<tipo>/<descricao-kebab-case>`:

| Tipo | Quando usar | Exemplo |
|------|-------------|---------|
| `feat/` | Nova funcionalidade | `feat/carga-base-oficial` |
| `fix/` | Correção de bug | `fix/runout-calculo-dias` |
| `refactor/` | Refatoração sem nova feature | `refactor/stock-engine-shared` |
| `test/` | Apenas testes | `test/sync-concorrencia` |
| `docs/` | Apenas documentação | `docs/readme-anexo-ii` |
| `chore/` | Config, deps, CI | `chore/atualizar-dependencias` |

### 3.2 Ciclo Obrigatório de Branch

```
dev (branch base)
 └─► git checkout -b feat/nome-da-tarefa   ← SEMPRE crie branch nova
      ├─ RED:    escreva o teste (falha esperada)
      ├─ GREEN:  implemente o mínimo para passar
      ├─ REFACTOR: limpe e valide todos os testes
      ├─ git add . && git commit -m "tipo: mensagem clara"
      ├─ git push -u origin feat/nome-da-tarefa
      └─► Abra Pull Request para `dev` no GitHub
```

### 3.3 Mensagens de Commit (Conventional Commits)

Siga o padrão **Conventional Commits**:

```
<tipo>(<escopo opcional>): <descrição em minúsculas>

Exemplos:
feat(api): adicionar endpoint POST /stock/analyze
fix(stock-engine): corrigir cálculo de dias de calendário
test(desktop): cobrir edge cases de runout com lista vazia
docs(readme): atualizar seção de limitações
```

### 3.4 Pull Requests

- **Base:** sempre `dev` (nunca `main` diretamente).
- **Título:** seguir o mesmo padrão de Conventional Commits.
- **Descrição:** referenciar a tarefa do `tarefas.md` (ex: `Resolve tarefa 6.1`).
- **Validação:** todos os testes devem passar antes de abrir o PR.
- **Após merge:** deletar a branch de feature (`git push origin --delete feat/nome`).

### 3.5 Sincronização com `dev` Antes de Cada Tarefa

Antes de criar qualquer nova branch, sempre sincronize com `origin/dev`:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/nova-tarefa
```

### 3.6 Atualização com o GitHub no Início de Cada Sessão

O projeto tem mais de uma pessoa (e mais de um agente) trabalhando ao mesmo tempo. No início de cada sessão, antes de qualquer tarefa:

```bash
git fetch --all --prune
git log --oneline dev..origin/dev          # commits novos em dev
git log --oneline main..origin/main        # commits novos em main
git branch -r                              # branches novas de outros membros
gh pr list --state open                    # PRs abertos aguardando revisão
```

- Atualize as branches locais `dev` e `main` com `git pull --ff-only`.
- **Informe ao usuário** o que mudou: commits novos, branches novas (autor, data e resumo do diff) e PRs abertos.
- Não faça merge nem rebase do trabalho de outro membro sem o usuário pedir.

---

## 🚫 4. Regras e Restrições Rígidas

- **Sem código sem teste prévio:** É expressamente proibido criar arquivos de serviços, controllers, cálculos agronômicos ou funções de sincronização sem que um teste automatizado tenha sido escrito antes.
- **Sem commits diretos em `main` ou `dev`:** Todo código passa por branch + PR.
- **Validação contínua:** Em cada etapa, mostre os comandos de teste executados e seus respectivos resultados (passes/fails).
- **Cobertura de Casos de Borda:** Todo teste de lógica de negócio (ex: cálculo de runout time, risco de vencimento, curva ABC, anomalias de consumo) deve obrigatoriamente testar casos felizes, valores zerados, listas vazias, dados nulos/ausentes e entradas inválidas.

---

## 🧭 5. Princípios de Comportamento (Karpathy)

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

Em caso de conflito, o fluxo de TDD e Git deste projeto (seções 1 a 4) prevalece sobre estas diretrizes.
