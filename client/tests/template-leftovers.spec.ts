import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";

// Tarefa 12.12: o parecer da seleção apontou restos dos modelos de projeto.
const root = (path: string) => fileURLToPath(new NodeURL(`../../${path}`, import.meta.url));

describe("sem restos dos modelos de projeto (tarefa 12.12)", () => {
  it("o cliente não tem o componente de exemplo do Vite", () => {
    expect(existsSync(root("client/src/components/HelloWorld.vue"))).toBe(false);
  });

  it("o README da API descreve o projeto, não o modelo do NestJS", () => {
    const readme = readFileSync(root("api/README.md"), "utf8");
    expect(readme).not.toMatch(/nestjs\.com\/img|circleci|Nest is a framework/i);
    expect(readme).toMatch(/API do AgroHacka/);
  });
});
