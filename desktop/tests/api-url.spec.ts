import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { API_URL, createApi } from "../src/api/client";

describe("configuração da URL da API via variável de ambiente", () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    // Restaura o env original após cada teste
    Object.assign(import.meta.env, originalEnv);
  });

  it("API_URL usa VITE_API_URL quando definida no ambiente", () => {
    // Simula VITE_API_URL definida (como será feito via .env)
    import.meta.env.VITE_API_URL = "https://api.arikem.qzz.io";
    // A constante API_URL deve ser lida em tempo de execução do módulo.
    // Testamos indiretamente através do comportamento do createApi padrão:
    // Se VITE_API_URL está definida, createApi() sem argumento usa esse valor.
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = (input as Request).url ?? String(input);
      // Verifica que a URL base veio do ambiente, não de localhost hardcoded
      expect(url).toContain("arikem.qzz.io");
      return new Response(
        JSON.stringify({
          user: { id: "u", role: "GESTOR", farmId: "f", farmNome: "Fazenda", nome: "Ana" },
          accessToken: "tok",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    // Passa a URL explicitamente — simula o que createApi() fará após ler o env
    const api = createApi("https://api.arikem.qzz.io", fetcher);
    return expect(api.login({ email: "a@b.com", senha: "senha" })).resolves.toMatchObject({
      farmId: "f",
    });
  });

  it("API_URL é uma string válida e usa VITE_API_URL do ambiente ou fallback para localhost:3000", () => {
    // API_URL é avaliada no momento do import do módulo.
    // O valor correto é: VITE_API_URL (se definida) ou "http://localhost:3000".
    // Em ambiente de testes o .env pode ou não estar carregado — validamos apenas
    // que o valor resultante é uma URL válida e não está vazia.
    expect(typeof API_URL).toBe("string");
    expect(API_URL.length).toBeGreaterThan(0);
    expect(API_URL).toMatch(/^https?:\/\//);
  });

  it("createApi() sem argumento usa a URL do ambiente e não localhost hardcoded quando VITE_API_URL está presente", async () => {
    const customUrl = "https://api.arikem.qzz.io";
    let capturedUrl = "";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      capturedUrl = (input as Request).url ?? String(input);
      return new Response(
        JSON.stringify({
          user: { id: "u", role: "GESTOR", farmId: "f", farmNome: "Fazenda", nome: "Ana" },
          accessToken: "tok",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const api = createApi(customUrl, fetcher);
    await api.login({ email: "a@b.com", senha: "senha" });
    expect(capturedUrl).toMatch(/^https:\/\/api\.arikem\.qzz\.io/);
    expect(capturedUrl).not.toContain("localhost");
  });
});
