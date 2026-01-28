import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Separate build config for the auto-init IIFE bundle
 * This creates a single self-contained file that can be loaded with:
 *   <script src="verse-detection-auto.js"></script>
 */
export default defineConfig({
	build: {
		outDir: 'dist',
		emptyOutDir: false, // Don't clear the main build output
		sourcemap: true,

		lib: {
			entry: resolve(__dirname, 'auto.ts'),
			name: 'VerseDetectionAuto',
			fileName: () => 'verse-detection.min.js',
			formats: ['iife']
		},

		rollupOptions: {
			output: {
				// Inline everything into one file
				inlineDynamicImports: true,
				// Make it a proper IIFE that runs immediately
				extend: true
			}
		},

		minify: 'esbuild',
		target: 'es2015'
	}
});
