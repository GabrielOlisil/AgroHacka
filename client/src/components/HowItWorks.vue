<script setup lang="ts">
// Tarefa 12.18: the rules in plain words, the same ones the analysis engine uses
// (client/src/offline/analysis.ts and api/src/stock-engine/stock-engine.ts).
const alerts = [
  ["Falta", "Saldo no mínimo ou estoque para até 7 dias", "Urgente", "Comprar o suficiente para 30 dias de uso"],
  ["Falta", "Estoque para 8 a 15 dias", "Atenção", "Planejar a compra para 30 dias de uso"],
  ["Vencimento", "Vencido ou vence hoje", "Urgente", "Separar e confirmar com o responsável técnico antes de usar ou descartar"],
  ["Vencimento", "Vence em até 30 dias e deve sobrar produto", "Atenção", "Usar primeiro e não repetir a compra nesse volume"],
  ["Fora do padrão", "Uma retirada de 3 vezes ou mais a média das retiradas anteriores (com pelo menos 3 antes dela, nos últimos 30 dias)", "Atenção", "Conferir com quem retirou se a quantidade está certa"],
  ["Consumo crescente", "Uso por dia nos últimos 15 dias 50% maior que nos 15 dias anteriores (com pelo menos 2 retiradas em cada metade)", "Atenção", "Conferir se o aumento era esperado e antecipar a próxima compra"],
  ["Cadastro duplicado", "Dois ou mais insumos com o mesmo nome, sem contar maiúsculas, acentos, espaços e símbolos", "Atenção", "Conferir os cadastros e registrar as próximas movimentações em um só"],
  ["Parado", "Há saldo, mas nenhuma retirada em 30 dias", "Informativo", "Não comprar mais até voltar a ter saída"],
  ["Excesso", "Estoque para mais de 90 dias", "Informativo", "Não comprar mais até o estoque baixar"],
];
const questions = [
  ["O que está acabando e precisa ser comprado?", "Alertas de falta na Visão geral, já dizendo quanto comprar."],
  ["Quais produtos podem vencer antes do uso?", "Alertas de vencimento e a coluna Validade do Estoque."],
  ["Quanto está sendo consumido de cada produto?", "Uso médio por dia no Estoque e o gráfico de consumo na Visão geral."],
  ["Existem consumos fora do padrão?", "Alertas de fora do padrão e de consumo crescente."],
  ["Por quanto tempo o estoque será suficiente?", "Duração estimada de cada insumo no Estoque."],
  ["Quais produtos representam maior valor financeiro?", "Valor armazenado e curva ABC no Estoque; alertas de parado e excesso."],
  ["Quais itens merecem atenção imediata?", "O resumo no topo e os alertas urgentes da Visão geral."],
];
</script>

<template>
  <div class="how-it-works" data-testid="how-it-works">
    <section class="panel">
      <h2>O que o app faz</h2>
      <p>
        Quem trabalha no campo registra entradas e saídas no celular, mesmo sem
        internet. O app guarda tudo no aparelho, refaz a análise na hora e envia
        os registros quando a internet volta. O gestor vê os alertas, o estoque e
        o histórico, e recebe os urgentes no WhatsApp.
      </p>
    </section>

    <section class="panel">
      <h2>Quando cada alerta aparece</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Alerta</th><th>Quando aparece</th><th>Prioridade</th><th>O que fazer</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in alerts" :key="i">
              <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>De onde vem a conta</h2>
      <ul>
        <li>
          <strong>Uso médio por dia:</strong> tudo o que saiu nos últimos 30 dias,
          dividido pelos dias desde a primeira retirada, contando os dias sem
          retirada.
        </li>
        <li><strong>Duração:</strong> saldo dividido pelo uso médio por dia.</li>
        <li>
          <strong>Quanto comprar:</strong> o suficiente para 30 dias de uso, sem
          ficar abaixo do mínimo, arredondado para cima. Quando o insumo tem
          preço, o alerta mostra o custo.
        </li>
        <li>
          <strong>Quanto confiar na previsão:</strong> com 1 ou 2 retiradas, ela vem
          marcada como "Poucos dados"; com 3 ou 4, "Dados razoáveis"; com 5 ou
          mais, "Bons dados".
        </li>
        <li>
          <strong>Curva ABC:</strong> valor de cada insumo = saldo × preço. Os que
          somam até 80% do valor total são A, até 95% são B, e o resto é C.
        </li>
        <li>
          <strong>Unidades e dados que faltam:</strong> litros, quilos e sacas
          nunca são somados entre si. Insumo sem preço fica fora do valor total e
          da curva ABC, e o total aparece como parcial. Insumo sem validade não
          gera alerta de vencimento.
        </li>
      </ul>
    </section>

    <section class="panel">
      <h2>Em que ordem os alertas aparecem</h2>
      <ol>
        <li>Primeiro os urgentes, depois os de atenção e, por fim, os informativos.</li>
        <li>
          No mesmo nível: falta, vencimento, fora do padrão, consumo crescente,
          parado e excesso.
        </li>
        <li>
          Dentro de cada tipo, o mais grave primeiro: menos dias restantes, maior
          valor que vai sobrar, maior pico. Empate: maior valor em estoque.
        </li>
      </ol>
      <p class="muted">
        Os limites de 7, 15, 30 e 90 dias e de 50% foram escolhidos pela equipe e
        são fáceis de conferir. Numa fazenda real, devem ser ajustados com a
        Agronomia, conforme a cultura e a época do ano.
      </p>
    </section>

    <section class="panel">
      <h2>As sete perguntas do desafio</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Pergunta</th><th>Onde ver no app</th></tr>
          </thead>
          <tbody>
            <tr v-for="([question, answer], i) in questions" :key="i">
              <td>{{ i + 1 }}. {{ question }}</td>
              <td>{{ answer }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
