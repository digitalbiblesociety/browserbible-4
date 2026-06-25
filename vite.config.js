import { defineConfig } from 'vite';
import { resolve, sep } from 'path';
import { readFileSync, cpSync } from 'fs';
import { browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
import { compression } from 'vite-plugin-compression2';

const siteProfile = process.env.SITE || 'dev';
const siteConfig = JSON.parse(readFileSync(`./sites/${siteProfile}.json`, 'utf-8'));

// Production builds exclude the (gitignored) starter-pack texts from public/ —
// deployed sites load texts from baseContentUrl, and copying them balloons
// dist to several hundred MB. Dev-profile builds keep them for local content.
function copyPublicExcludingTexts() {
  const publicDir = resolve(__dirname, 'browserbible/public');
  const textsDir = resolve(publicDir, 'content/texts');
  return {
    name: 'copy-public-excluding-texts',
    apply: 'build',
    // writeBundle (not closeBundle) so the compression plugin still sees
    // the copied files and emits .gz/.br variants
    writeBundle() {
      cpSync(publicDir, resolve(__dirname, 'browserbible/dist'), {
        recursive: true,
        filter: (src) => {
          const full = resolve(src);
          return full !== textsDir && !full.startsWith(textsDir + sep);
        }
      });
    }
  };
}

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

    // Sourcemaps only in dev-profile builds — production builds (SITE=inscript)
    // must not ship .map files exposing the source
    sourcemap: siteProfile === 'dev',

    // Use Lightning CSS for minification
    cssMinify: 'lightningcss',

    // Public assets are copied by Vite in dev-profile builds; production
    // builds use copyPublicExcludingTexts() below
    copyPublicDir: siteProfile === 'dev',

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
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '4.0.0'),
    __DISABLED_WINDOW_TYPES__: JSON.stringify(siteConfig.disabledWindowTypes),
    __DISABLED_FEATURES__: JSON.stringify(siteConfig.disabledFeatures)
  },

  // Plugins
  plugins: [
    siteProfile !== 'dev' && copyPublicExcludingTexts(),
    compression({ algorithms: ['gzip', 'brotliCompress'] })
  ].filter(Boolean)
});
