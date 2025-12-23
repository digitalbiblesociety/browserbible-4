import * as esbuild from 'esbuild';
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const isDev = process.argv.includes('--dev');

// Ensure dist directory exists
try {
  mkdirSync('app/dist', { recursive: true });
} catch (e) {}

// Get all CSS files from the js directory (component styles)
function getComponentCss(dir, files = []) {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      getComponentCss(fullPath, files);
    } else if (entry.endsWith('.css')) {
      files.push(fullPath);
    }
  }
  return files;
}

const componentCssFiles = getComponentCss('app/js');

// Build configuration
const config = {
  entryPoints: ['app/js/main.js'],
  bundle: true,
  outfile: 'app/dist/bundle.js',
  format: 'iife',
  target: ['es2020'],
  sourcemap: isDev,
  minify: !isDev,
  metafile: true,
  loader: {
    '.js': 'js',
  },
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
  // Handle external dependencies that might not exist yet
  external: [],
  logLevel: 'info',
};

// Create a CSS entry point that imports all CSS files
const cssEntryContent = `
/* Auto-generated CSS entry point */
@import "../css/fonts.css";
@import "../css/bible.css";
@import "../css/windows.css";
@import "../css/common.css";
${componentCssFiles.map(f => `@import "../${f.replace('app/', '')}";`).join('\n')}
`;

// Write the CSS entry file
writeFileSync('app/dist/styles-entry.css', cssEntryContent);

// CSS build configuration
const cssConfig = {
  entryPoints: ['app/dist/styles-entry.css'],
  bundle: true,
  outfile: 'app/dist/bundle.css',
  minify: !isDev,
  sourcemap: isDev,
  loader: {
    '.svg': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.gif': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.ttf': 'dataurl',
    '.eot': 'dataurl',
  },
};

async function build() {
  try {
    // Build JS
    const jsResult = await esbuild.build(config);
    console.log('JS bundle built successfully');

    if (jsResult.metafile) {
      const analysis = await esbuild.analyzeMetafile(jsResult.metafile);
      console.log(analysis);
    }

    // Build CSS
    await esbuild.build(cssConfig);
    console.log('CSS bundle built successfully');

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  const jsContext = await esbuild.context({
    ...config,
    sourcemap: true,
  });

  const cssContext = await esbuild.context({
    ...cssConfig,
    sourcemap: true,
  });

  await jsContext.watch();
  await cssContext.watch();

  console.log('Watching for changes...');
}

if (process.argv.includes('--watch')) {
  watch();
} else {
  build();
}
