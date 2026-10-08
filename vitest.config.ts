import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./apps/mobile/src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${src}/` },
      // component tests render React Native primitives through react-native-web in jsdom
      { find: /^react-native$/, replacement: 'react-native-web' },
    ],
  },
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['packages/**/*.test.ts', 'tools/**/*.test.ts', 'apps/mobile/**/*.test.ts', 'apps/mobile/**/*.test.tsx', 'copy/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    environmentMatchGlobs: [['apps/mobile/**/*.test.tsx', 'jsdom']],
    setupFiles: ['./vitest.setup.ts'],
  },
});
