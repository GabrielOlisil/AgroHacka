import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/sync.postgres.integration.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 90000,
  },
});
