import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 웹 포털과 Capacitor 모두 상대 경로로 에셋을 읽어야 해서 './'로 둔다.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
