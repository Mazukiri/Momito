import { defineConfig } from 'vitest/config';
import path from 'node:path';

// No @vitejs/plugin-react — tsconfig.json's "jsx": "react-jsx" is enough for
// Vite's default esbuild transform to handle .tsx in tests; the plugin is
// mainly for dev-server Fast Refresh, which `vitest run` doesn't need, and
// pulling it in dragged a vite version conflict in this monorepo's install.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@momito/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
