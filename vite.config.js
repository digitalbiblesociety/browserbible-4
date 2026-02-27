import { defineConfig } from 'vite';
import { resolve } from 'path';
import { browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  // Root directory for the app
  root: 'browserbible',

  // Base public path
  base: './',

  // Build configuration
  build: {
    // Output directory (relative to root)
    outDir: 'dist',

    // Empty the output directory before building
    emptyOutDir: true,

    // Generate sourcemaps for debugging
    // 'true' = separate .map files
    // 'inline' = inline sourcemaps (larger but single file)
    // 'hidden' = .map files without sourceMappingURL comment
    sourcemap: true,

    // Use Lightning CSS for minification
    cssMinify: 'lightningcss',

    // CSS sourcemaps (matches JS sourcemap: true above)
    cssSourcemap: true,

    // Copy public assets
    copyPublicDir: true,

    // Rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'browserbible/index.html')
      },
      output: {
        // Output file naming
        entryFileNames: 'js/bundle.js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name.split('.').pop();
          if (/css/i.test(extType)) {
            return 'css/[name][extname]';
          }
          if (/png|jpe?g|gif|svg|ico|webp/i.test(extType)) {
            return 'images/[name][extname]';
          }
          if (/woff2?|ttf|eot/i.test(extType)) {
            return 'fonts/[name][extname]';
          }
          return 'assets/[name][extname]';
        }
      }
    },

    // Minification
    minify: 'esbuild',

    // JS target — matches CSS baseline (oklch, color-mix, popover API)
    target: 'es2022'
  },

  // Development server configuration
  server: {
    port: 3000,
    open: true,
    cors: true
  },

  // Preview server configuration
  preview: {
    port: 4173
  },

  // CSS configuration — Lightning CSS for transforms, prefixing, and minification
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: browserslistToTargets(browserslist('chrome >= 111, firefox >= 113, safari >= 16.4'))
    },
    devSourcemap: true
  },

  // Resolve configuration
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

  // Optimize dependencies
  optimizeDeps: {
    include: []
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '4.0.0')
  },

  // Plugins
  plugins: [
    compression({ algorithms: ['gzip', 'brotliCompress'] })
  ]
});
