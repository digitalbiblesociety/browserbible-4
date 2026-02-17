/**
 * Auto-initializing Verse Detection
 *
 * Just include this script and it automatically detects and links
 * Bible verse references in your page.
 *
 * Usage:
 *   <script src="verse-detection-auto.js"></script>
 *
 * Configuration via data attributes on the script tag:
 *   <script src="verse-detection-auto.js"
 *     data-app-url="https://inscript.org"
 *     data-mode="both"
 *     data-selector=".content"
 *   ></script>
 *
 * Options:
 *   data-app-url    - Base URL for verse links (default: https://inscript.org)
 *   data-mode       - Display mode: 'popup', 'link', or 'both' (default: both)
 *   data-selector   - CSS selector for content to process (default: body)
 *   data-new-tab    - Open links in new tab: 'true' or 'false' (default: true)
 *   data-language   - Primary language code (default: auto-detect)
 *   data-show-logo  - Show inscript.org logo in popup: 'true' or 'false' (default: true)
 */

import { initVerseDetection, type InitializedVerseDetection } from './VerseDetectionPlugin.js';

// Get configuration from script tag data attributes
function getConfig(): {
	appUrl: string;
	mode: 'popup' | 'link' | 'both';
	selector: string;
	newTab: boolean;
	language: string | null;
	showLogo: boolean;
} {
	// Find our script tag
	const scripts = document.querySelectorAll('script[src*="verse-detection"]');
	const scriptTag = scripts[scripts.length - 1] as HTMLScriptElement | null;

	return {
		appUrl: scriptTag?.dataset.appUrl ?? 'https://inscript.org',
		mode: (scriptTag?.dataset.mode as 'popup' | 'link' | 'both') || 'both',
		selector: scriptTag?.dataset.selector ?? 'body',
		newTab: scriptTag?.dataset.newTab !== 'false',
		language: scriptTag?.dataset.language ?? null,
		showLogo: scriptTag?.dataset.showLogo !== 'false'
	};
}

// Auto-initialize when DOM is ready
async function autoInit(): Promise<void> {
	const config = getConfig();

	try {
		const verseSystem: InitializedVerseDetection = await initVerseDetection(null, {
			appBaseUrl: config.appUrl,
			displayMode: config.mode,

			contentSource: {
				type: 'remote',
				baseUrl: `https://inscript.bible.cloud/content/${new URLSearchParams(window.location.search).get('dev') === 'true' ? 'texts_dev' : 'texts'}`,
				textsIndexUrl: `https://inscript.bible.cloud/content/${new URLSearchParams(window.location.search).get('dev') === 'true' ? 'texts_dev' : 'texts'}/texts.json`,
				dynamicTextSelection: true,
				autoSelectByLanguage: true,
				preferredTextIdsByLanguage: {
					'en': 'ENGWEB',
					'es': 'SPNRVG',
					'pt': 'PORBLS',
					'fr': 'FRALSG',
					'de': 'GERLUT',
					'ru': 'RUSSYN'
				}
			},

			language: {
				autoDetect: !config.language,
				primary: config.language ?? undefined,
				additional: 'all'
			},

			link: {
				openInNewTab: config.newTab,
				useHashNavigation: true
			},

			versionLinking: {
				includeVersion: true,
				versionParam: 'version'
			},

			popup: {
				showLogo: config.showLogo,
				logoUrl: config.appUrl
			},

			// Disable app integration for standalone use
			appIntegration: {
				useAppTextLoader: false,
				useAppNavigation: false,
				registerAsPlugin: false,
				syncLanguage: false
			}
		});

		// Process selected containers
		const containers = document.querySelectorAll<HTMLElement>(config.selector);
		containers.forEach(container => {
			verseSystem.processContainer(container);
		});

		// Expose for debugging/customization
		(window as any).verseDetection = verseSystem;

		console.log('[Verse Detection] Initialized successfully');
		console.log('[Verse Detection] Processed', containers.length, 'container(s)');

	} catch (error) {
		console.error('[Verse Detection] Initialization failed:', error);
	}
}

// Run when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', autoInit);
} else {
	autoInit();
}
