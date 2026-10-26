import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // client/src/api/client.ts lança no import sem VITE_API_URL; a suíte injeta
    // seu próprio fetch/baseUrl, então o valor aqui nunca é chamado de verdade.
    env: { VITE_API_URL: 'http://localhost:3000' },
    include: ['test/sync.postgres.integration.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 90000,
  },
});
