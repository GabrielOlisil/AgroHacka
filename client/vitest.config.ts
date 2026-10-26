import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // Carrega .env.test (e .env) do mesmo diretório durante os testes.
  // Em dev, o Vite usa .env.development; no build, .env.production.
  envDir: ".",
  envPrefix: ["VITE_"],
  test: {
    environment: "node",
    include: ["tests/**/*.spec.ts"],
    fileParallelism: false,
  },
});
