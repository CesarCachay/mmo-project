import { fileURLToPath, URL } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '#app': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  test: {
    exclude: [...configDefaults.exclude, '**/dist/**', '**/*.spec.ts'],
  },
});
