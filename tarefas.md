# 📋 Checklist de Tarefas — AgroHack 2026/2 (IFRO)

> **Desafio Oficial:** Gestão Inteligente de Insumos em uma Propriedade Rural  
> **Objetivo:** Transformar registros de estoque em informações úteis para identificar problemas, antecipar necessidades e apoiar decisões.  
> **Data de Apresentação:** 29 de outubro de 2026 (SNCT)  
> **Premiação:** R$ 2.000,00  

---

## 📌 Fase 1: Gestão de Inscrição, Equipe e Repositório
*Tarefas administrativas e de conformidade obrigatórias pelo regulamento.*

- [ ] **1.1. Conferir dados de inscrição:** Verificar protocolo e chave de acesso da equipe na plataforma [incubadora.cloud/agrohack](https://incubadora.cloud/agrohack/).
- [ ] **1.2. Configurar acesso ao GitHub:** Garantir que o repositório esteja acessível à banca avaliadora (público ou com permissões concedidas aos avaliadores).
- [ ] **1.3. Submeter link do repositório:** Cadastrar o link oficial do GitHub na área "Minha equipe" no site do evento dentro do prazo limite divulgado.
- [ ] **1.4. Identificar versão de entrega:** Criar uma `tag` ou registrar o hash do `commit` final para avaliação da banca.

---

## 📊 Fase 2: Ingestão e Tratamento de Dados
*Obrigatório para viabilizar as análises sem erros grosseiros apontados no regulamento.*

- [ ] **2.1. Carga da base de dados:**
  - [ ] Preparar ambiente para importar a base oficial do desafio assim que for divulgada.
  - [ ] Criar/utilizar base de dados simulada com situações normais e problemáticas para desenvolvimento e testes iniciais (identificada claramente como simulada).
- [ ] **2.2. Tratamento e higienização dos registros:**
  - [ ] Padronizar produtos cadastrados com nomes ou grafias diferentes (ex: "NPK 10-10-10", "npk 10 10 10").
  - [ ] Tratar unidades de medida distintas (não somar unidades diferentes como `kg`, `L`, `sc`, `un` sem a devida conversão/tratamento).
  - [ ] Tratar campos ausentes ou nulos (garantir que ausência de preço ou data de validade não seja interpretada erroneamente como zero).
- [ ] **2.3. Atualização e reanálise dinâmica:**
  - [ ] Implementar fluxo de inclusão/registro de novas movimentações (entradas, saídas, compras).
  - [ ] Garantir recálculo e reanálise imediata dos alertas e indicadores após qualquer atualização dos registros (requisito explícito do regulamento).

---

## 🧠 Fase 3: Regras de Negócio e Inteligência de Estoque
*As 7 perguntas centrais que a solução é OBRIGADA a responder segundo o desafio.*

- [ ] **3.1. Risco de Falta e Estoque Crítico:**
  - [ ] Identificar produtos com saldo abaixo do estoque mínimo.
  - [ ] Cruzar saldo atual com o ritmo de consumo recente para alertar produtos que vão acabar em breve.
- [ ] **3.2. Estimativa de Duração do Estoque (Runout Time):**
  - [ ] Calcular a projeção de dias/semanas de autonomia para cada insumo com base no consumo médio.
  - [ ] Apresentar justificativa compreensível do cálculo (ex: *"Mantendo o consumo médio recente, o saldo será suficiente por aproximadamente 8 dias"*).
  - [ ] Tratar e comunicar a incerteza para itens com pouco histórico de movimentação.
- [ ] **3.3. Risco de Vencimento:**
  - [ ] Identificar produtos com prazo de validade próximo.
  - [ ] Cruzar lote/validade com a taxa de consumo para alertar produtos que vão vencer antes de serem totalmente utilizados.
- [ ] **3.4. Variação e Tendência de Consumo:**
  - [ ] Mapear o consumo de cada produto ao longo do tempo (identificar períodos de pico, sazonalidade e tendências de aumento).
- [ ] **3.5. Detecção de Anomalias e Movimentações Fora do Padrão:**
  - [ ] Detectar retiradas ou saídas atípicas (quantidades muito superiores à média habitual da propriedade).
  - [ ] Apontar mudanças abruptas no padrão de consumo de itens específicos.
- [ ] **3.6. Concentração Financeira e Excesso de Estoque:**
  - [ ] Identificar onde está concentrado o maior valor monetário do estoque (curva ABC / capital imobilizado).
  - [ ] Detectar produtos com estoque excessivo e baixa rotatividade (dinheiro parado).
- [ ] **3.7. Motor de Priorização de Alertas:**
  - [ ] Categorizar os alertas por nível de severidade/urgência (ex: Urgente, Atenção, Normal), evitando tratar todos os problemas como iguais.
  - [ ] Destacar claramente na interface: *"Quais itens merecem atenção imediata e por quê"*.

---

## 🖥️ Fase 4: Interface e Experiência do Usuário (Painel do Produtor)
*Apresentação simples, eficiente e acessível para o responsável pela propriedade rural.*

- [ ] **4.1. Dashboard com Visão Geral e Prioridades:**
  - [ ] Tela inicial destacando os alertas críticos imediatos e resumo financeiro/operacional.
- [ ] **4.2. Visualização e Consulta de Estoque:**
  - [ ] Listagem de produtos com filtros por categoria, status de risco, validade e valor.
- [ ] **4.3. Telas de Detalhes e Justificativas:**
  - [ ] Exibição transparente do porquê de cada alerta e de como foram obtidas as previsões.
- [ ] **4.4. Interface para Entrada de Dados e Demonstração da Reanálise:**
  - [ ] Interface prática para registrar nova movimentação e visualizar a atualização imediata dos alertas.

---

## 🧪 Fase 5: Testes, Validação e Limitações
*Critério de 15 pontos da banca avaliadora.*

- [ ] **5.1. Testes com a base oficial:** Executar a solução com a base de dados real fornecida pela organização e conferir os resultados.
- [ ] **5.2. Testes de casos de borda (edge cases):** Validar comportamento com itens sem preço, sem validade, produtos novos sem histórico e estoques zerados.
- [ ] **5.3. Mapeamento de limitações:** Documentar formalmente o que a solução faz com precisão e quais são as limitações atuais (o que pode ser melhorado em versões futuras).

---

## 📦 Fase 6: Documentação Obrigatória do Repositório (README)
*Seguir rigorosamente o Anexo II do regulamento no `README.md`.*

- [ ] **6.1. Seção Equipe:** Nomes completos, cursos, turmas, funções de cada integrante e identificação do responsável (ADS).
- [ ] **6.2. Seção Problema e Público:** Contextualização do agronegócio, perfil do usuário e decisões que a ferramenta apoia.
- [ ] **6.3. Seção Solução:** Descrição geral das funcionalidades e guia rápido.
- [ ] **6.4. Seção Como Testar:** Instruções passo a passo reproduzíveis para instalação, execução local e carga dos dados.
- [ ] **6.5. Seção Dados e Critérios:** Dicionário dos dados, tratamentos feitos, fórmulas dos alertas e limites das estimativas.
- [ ] **6.6. Seção Demonstração:** Links para o vídeo demonstrativo, exemplos de uso e evidência da reanálise de dados.
- [ ] **6.7. Seção Validação e Testes:** Resumo dos testes executados, resultados observados e limitações da solução.
- [ ] **6.8. Seção Tecnologias e Uso de IA:**
  - [ ] Listagem das tecnologias utilizadas.
  - [ ] Declaração formal das ferramentas de IA utilizadas, com finalidade, partes apoiadas e revisões feitas (ou declaração expressa de não uso).
- [ ] **6.9. Seção Autoria, Referências e Licença:** Fontes consultadas, termos de uso/licença e garantia de nenhuma credencial ou chave de API exposta.
- [ ] **6.10. Seção Versão de Entrega:** Registro da versão/tag final entregue.

---

## 🎥 Fase 7: Vídeo Demonstrativo e Materiais de Apresentação
*Entregáveis obrigatórios no repositório para avaliação.*

- [ ] **7.1. Gravação do Vídeo Demonstrativo:**
  - [ ] Gravar vídeo mostrando a solução funcionando com os dados do desafio.
  - [ ] Demonstrar os alertas, a lógica/justificativa e o fluxo de reanálise após atualizar registros.
  - [ ] Subir o vídeo (YouTube não listado, Drive compartilhado ou arquivo no repositório) e disponibilizar link no `README.md`.
- [ ] **7.2. Produção dos Slides / Pitch:**
  - [ ] Criar apresentação com foco no problema rural, demonstração prática, critérios dos alertas e valor gerado para o produtor.
  - [ ] Salvar os slides/materiais de apresentação dentro do repositório.

---

## 🎤 Fase 8: Apresentação Final (SNCT — 29/10/2026)
*Banca avaliadora presencial.*

- [ ] **8.1. Roteiro de Pitch e Demonstração:** Ensaiar a apresentação respeitando o tempo estipulado pela organização.
- [ ] **8.2. Preparação para a Sabatina:** Alinhar com a equipe as respostas sobre decisões de código, critérios de alertas, limitações e uso de IA.
- [ ] **8.3. Presença e Credenciamento:** Garantir a presença de todos os integrantes no IFRO Campus Ariquemes para os registros de presença e certificação.
