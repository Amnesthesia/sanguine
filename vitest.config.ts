import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'tools/**/*.test.ts', 'apps/mobile/**/*.test.ts', 'apps/mobile/**/*.test.tsx', 'copy/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
