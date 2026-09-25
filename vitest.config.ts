import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src/', import.meta.url)).replace(/\\/g, '/');

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: src },
      { find: 'server-only', replacement: fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) },
    ],
  },
  test: {
    environment: 'node',
    fileParallelism: false,
  },
});
