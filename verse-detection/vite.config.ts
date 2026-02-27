import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	// Build configuration for library mode
	build: {
		// Output directory
		outDir: 'dist',

		// Empty the output directory before building
		emptyOutDir: true,

		// Generate sourcemaps
		sourcemap: true,

		// Library mode configuration
		lib: {
			// Entry point
			entry: {
				'verse-detection': resolve(__dirname, 'index.ts'),
				'verse-detection-auto': resolve(__dirname, 'auto.ts'),
				'languages/index': resolve(__dirname, 'languages/index.ts'),
				'languages/types': resolve(__dirname, 'languages/types.ts')
			},

			// Library name for UMD/IIFE builds
			name: 'VerseDetection',

			// Output file names
			fileName: (format, entryName) => {
				if (format === 'es') return `${entryName}.js`;
				if (format === 'umd') return `${entryName}.umd.js`;
				return `${entryName}.${format}.js`;
			},

			// Only build ES modules for tree-shaking support
			formats: ['es']
		},

		// Rollup options
		rollupOptions: {
			// External dependencies (not bundled)
			external: [],

			output: {
				// Global variable names for UMD/IIFE builds
				globals: {},
				// Compact output
				compact: true,
				// Preserve modules for better tree-shaking
				preserveModules: false
			}
		},

		// Minification with esbuild (faster and similar size)
		minify: 'esbuild',

		// Target browsers
		target: 'es2015'
	},

	// Development server configuration
	server: {
		port: 3001,
		open: '/demo.html'
	},

	// Resolve configuration
	resolve: {
		alias: {
			// Allow importing from main app if needed
			'@bb4': resolve(__dirname, '../browserbible/js')
		}
	},

	// Define global constants
	define: {
		__VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
	}
});
