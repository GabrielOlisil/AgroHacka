import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";

// Tarefa 12.13: o README reflete o app da final e corrige o que o parecer da seleção apontou.
const readme = readFileSync(fileURLToPath(new NodeURL("../../README.md", import.meta.url)), "utf8");

describe("README da versão final (tarefa 12.13)", () => {
  it("usa o nome do software, Paiol", () => {
    expect(readme.split("\n")[0]).toMatch(/^# .*Paiol/);
  });

  it("não promete o que o código não faz nem traz texto herdado da IA", () => {
    expect(readme).not.toMatch(/desapercebid/i);
    expect(readme).not.toMatch(/O usuário confirmou/);
    expect(readme).not.toMatch(/Detecção Estatística|desvio estatístico|anomalia grave/i);
    expect(readme).not.toMatch(/sazonalidade/i);
  });

  it("tem as instruções locais completas: .env, PostgreSQL e tabelas antes da carga", () => {
    const local = readme.slice(readme.indexOf("### 4.2."), readme.indexOf("### 4.3."));
    const steps = ["cp .env.example .env", "docker run", "npx prisma db push", "npx tsx prisma/seed.ts"];
    for (const step of steps) expect(local).toContain(step);
    // Não há pasta de migrations: as tabelas vêm do schema, como no Dockerfile da API.
    expect(local).not.toContain("migrate deploy");
    expect(local.indexOf("npx prisma db push")).toBeLessThan(local.indexOf("npx tsx prisma/seed.ts"));
    expect(local).toMatch(/agro1234.*só.*local|local.*agro1234/s);
  });

  it("explica as regras novas e de onde vêm os limites", () => {
    for (const text of ["Consumo crescente", "O que fazer", "30 dias de uso", "Ordem dos alertas", "parâmetros escolhidos pela equipe"])
      expect(readme).toContain(text);
  });

  it("registra a revisão humana do uso de IA e a falta de retorno do público", () => {
    const ia = readme.slice(readme.indexOf("### 8.2."));
    expect(ia).toMatch(/\| .*Motor de análise.* \| .*Kauê/);
    expect(ia).toMatch(/\| .*Telas.* \| .*Gabriel/);
    expect(readme).toMatch(/Retorno do público/);
  });

  it("identifica a versão avaliada pela tag da final (tarefa 12.1)", () => {
    const version = readme.slice(readme.indexOf("## 10."));
    expect(version).toContain("**1.1.7**");
    // Tags só com a versão, sem sufixo.
    expect(version).toContain("releases/tag/v1.1.7)");
    expect(version).not.toMatch(/releases\/tag\/v[\d.]+-final/);
    expect(version).not.toContain("android-build-21");
  });

  it("liga o roteiro da demonstração ao vivo, que fica na raiz", () => {
    expect(readme).toContain("](roteiro-demonstracao-final.md)");
    const roteiro = readFileSync(fileURLToPath(new NodeURL("../../roteiro-demonstracao-final.md", import.meta.url)), "utf8");
    expect(roteiro).toContain("agro@agrohack.com");
  });

  it("aponta a data e o local certos da final", () => {
    expect(readme).toContain("30 de outubro de 2026");
    expect(readme).not.toContain("29 de outubro de 2026");
  });
});
