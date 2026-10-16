# 🧪 Diretrizes de Desenvolvimento — Test-Driven Development (TDD) Obrigatório

Neste projeto, você DEVE seguir rigorosamente a metodologia de **Desenvolvimento Orientado a Testes (TDD)** para toda e qualquer funcionalidade, lógica de negócio, serviço, utilitário ou endpoint.

---

## 🔁 O Ciclo Red-Green-Refactor é Mandatório

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

## 🚫 Regras e Restrições Rígidas

- **Sem código sem teste prévio:** É expressamente proibido criar arquivos de serviços, controllers, cálculos agronômicos ou funções de sincronização sem que um teste automatizado tenha sido escrito antes.
- **Validação contínua:** Em cada etapa, mostre os comandos de teste executados e seus respectivos resultados (passes/fails).
- **Cobertura de Casos de Borda:** Todo teste de lógica de negócio (ex: cálculo de runout time, risco de vencimento, curva ABC, anomalias de consumo) deve obrigatoriamente testar casos felizes, valores zerados, listas vazias, dados nulos/ausentes e entradas inválidas.
