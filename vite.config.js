import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync, readdirSync, mkdirSync } from 'fs';

// Plugin to copy content folder and resources after build
function postBuildPlugin() {
  return {
    name: 'post-build',
    closeBundle() {
      // Copy content folder
      const contentSrc = resolve(__dirname, 'app/content');
      const contentDest = resolve(__dirname, 'dist/content');
      if (existsSync(contentSrc)) {
        console.log('Copying content folder...');
        cpSync(contentSrc, contentDest, { recursive: true });
        console.log('Content folder copied.');
      }

      // Copy i18n resource JSON files
      const resourcesSrc = resolve(__dirname, 'app/js/resources');
      const resourcesDest = resolve(__dirname, 'dist/js/resources');
      if (existsSync(resourcesSrc)) {
        console.log('Copying i18n resources...');
        mkdirSync(resourcesDest, { recursive: true });
        const files = readdirSync(resourcesSrc).filter(f => f.endsWith('.json'));
        for (const file of files) {
          cpSync(resolve(resourcesSrc, file), resolve(resourcesDest, file));
        }
        console.log(`Copied ${files.length} language resource files.`);
      }
    }
  };
}

export default defineConfig({
  // Root directory for the app
  root: 'app',

  // Base public path
  base: './',

  // Build configuration
  build: {
    // Output directory (relative to root)
    outDir: '../dist',

    // Empty the output directory before building
    emptyOutDir: true,

    // Generate sourcemaps for debugging
    // 'true' = separate .map files
    // 'inline' = inline sourcemaps (larger but single file)
    // 'hidden' = .map files without sourceMappingURL comment
    sourcemap: true,

    // CSS sourcemaps
    cssMinify: 'esbuild',

    // Copy public assets
    copyPublicDir: true,

    // Rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/index.html')
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

    // Target browsers
    target: 'es2015'
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

  // CSS configuration
  css: {
    // Enable CSS source maps in development
    devSourcemap: true
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'app/js'),
      '@lib': resolve(__dirname, 'app/js/lib'),
      '@core': resolve(__dirname, 'app/js/core'),
      '@common': resolve(__dirname, 'app/js/common'),
      '@bible': resolve(__dirname, 'app/js/bible'),
      '@texts': resolve(__dirname, 'app/js/texts'),
      '@windows': resolve(__dirname, 'app/js/windows'),
      '@plugins': resolve(__dirname, 'app/js/plugins'),
      '@menu': resolve(__dirname, 'app/js/menu'),
      '@ui': resolve(__dirname, 'app/js/ui')
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
  plugins: [postBuildPlugin()]
});
