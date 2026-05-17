import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'browserbible/js'),
      '@lib': resolve(__dirname, 'browserbible/js/lib'),
      '@core': resolve(__dirname, 'browserbible/js/core'),
      '@common': resolve(__dirname, 'browserbible/js/common'),
      '@bible': resolve(__dirname, 'browserbible/js/bible'),
      '@texts': resolve(__dirname, 'browserbible/js/texts'),
      '@windows': resolve(__dirname, 'browserbible/js/windows'),
      '@plugins': resolve(__dirname, 'browserbible/js/plugins'),
      '@menu': resolve(__dirname, 'browserbible/js/menu'),
      '@ui': resolve(__dirname, 'browserbible/js/ui'),
      '@verse-detection': resolve(__dirname, 'verse-detection')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{js,ts}', 'tests/integration/**/*.test.{js,ts}'],
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['browserbible/js/**', 'verse-detection/**/*.ts'],
      exclude: [
        'browserbible/js/**/index.js',
        'verse-detection/dist/**',
        'verse-detection/demo*.html',
        'verse-detection/vite.config*.ts'
      ]
    }
  }
});
