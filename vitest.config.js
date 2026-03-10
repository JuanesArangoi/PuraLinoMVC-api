import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/routes/**', 'src/utils/**', 'src/middleware/**'],
    },
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
  },
});
