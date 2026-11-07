import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/globalSetup.js'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      reporter: ['text-summary', 'text'],
    },
  },
});
