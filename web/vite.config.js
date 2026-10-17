/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:47823',
    },
  },
  // Unit tests (Vitest). Specs live next to the source as `*.spec.ts`; they are
  // never imported from the app, so `vite build` does not bundle them.
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/composables/**/*.ts', 'src/stores/**/*.ts'],
      // Browser-only glue with no logic worth unit testing.
      exclude: ['src/**/*.spec.ts', 'src/test/**', 'src/lib/download.ts', 'src/composables/useTheme.ts'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
})
