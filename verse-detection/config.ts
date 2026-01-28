/**
 * Verse Detection Plugin Configuration
 *
 * This configuration file controls how detected verse references are displayed and handled.
 */

/** Display mode for detected verses */
export type DisplayMode = 'link' | 'popup' | 'both';

/** Content source type */
export type ContentSourceType = 'local' | 'remote' | 'app';

/** Popup position preference */
export type PopupPosition = 'auto' | 'above' | 'below';

/** Content source configuration */
export interface ContentSourceConfig {
	/** Source type for verse content */
	type: ContentSourceType;
	/** Base URL for content files */
	baseUrl: string;
	/** URL to the texts index JSON file */
	textsIndexUrl: string;
	/** Default text/version ID for fetching chapter content */
	textId: string | null;
	/** Auto-select text ID based on detected language */
	autoSelectByLanguage: boolean;
	/** Load available text IDs dynamically from the texts index JSON */
	dynamicTextSelection: boolean;
	/** Preferred text IDs by language code */
	preferredTextIdsByLanguage: Record<string, string | string[]>;
	/** Computed text IDs by language code (auto-populated at runtime) */
	textIdsByLanguage: Record<string, string>;
	/** Chapter file path template */
	pathTemplate: string;
}

/** Version linking configuration */
export interface VersionLinkingConfig {
	/** Include the Bible version in generated links */
	includeVersion: boolean;
	/** URL parameter name for the Bible version */
	versionParam: string;
	/** Allow override from the main app's configuration */
	respectAppConfig: boolean;
}

/** Popup configuration */
export interface PopupConfig {
	/** Delay in milliseconds before showing the popup on hover */
	showDelay: number;
	/** Delay in milliseconds before hiding the popup when mouse leaves */
	hideDelay: number;
	/** Maximum width of the popup in pixels */
	maxWidth: number;
	/** Maximum height of the popup content in pixels */
	maxHeight: number;
	/** Show verse numbers in the popup */
	showVerseNumbers: boolean;
	/** Show the book and chapter reference as a header in the popup */
	showHeader: boolean;
	/** Custom CSS class to add to the popup container */
	cssClass: string;
	/** Position preference for the popup */
	position: PopupPosition;
	/** Enable loading indicator while fetching verse content */
	showLoadingIndicator: boolean;
	/** Cache fetched verse content to avoid repeated requests */
	cacheContent: boolean;
	/** Show the inscript.org logo in the popup header */
	showLogo: boolean;
	/** URL the logo links to */
	logoUrl: string;
	/** Show social media sharing buttons in popup footer (below footnotes area) */
	showSocialShare: boolean;
	/** Social share platforms to show in order: 'facebook', 'x' (Twitter), 'bluesky', 'copy' (clipboard) */
	socialSharePlatforms: ('facebook' | 'x' | 'bluesky' | 'copy')[];
}

/** Link configuration */
export interface LinkConfig {
	/** Custom URL template for verse links */
	urlTemplate: string | null;
	/** URL parameter name for the verse reference */
	refParam: string;
	/** CSS class to add to verse links */
	cssClass: string;
	/** Open links in new tab/window */
	openInNewTab: boolean;
	/** Add data attributes to links for JavaScript handling */
	addDataAttributes: boolean;
	/** Use hash-based navigation */
	useHashNavigation: boolean;
}

/** Styling configuration */
export interface StylingConfig {
	/** Highlight detected verses with a background color */
	highlightVerses: boolean;
	/** CSS class for highlighted verses */
	highlightClass: string;
	/** Underline detected verses */
	underline: boolean;
}

/** Language configuration */
export interface LanguageConfig {
	/** Auto-detect language from HTML document */
	autoDetect: boolean;
	/** Primary language to use (overrides auto-detection if set) */
	primary: string | null;
	/** Additional languages to support alongside primary. Use 'all' to load all supported languages. */
	additional: string[] | 'all';
	/** Always include English as a fallback */
	alwaysIncludeEnglish: boolean;
}

/** Detection configuration */
export interface DetectionConfig {
	/** Minimum book name length to match */
	minBookNameLength: number;
	/** Require chapter number */
	requireChapter: boolean;
	/** Allow chapter-only references */
	allowChapterOnly: boolean;
	/** Elements to scan for verse references (CSS selectors) */
	autoScanSelectors: string | null;
	/** Elements to exclude from scanning (CSS selectors) */
	excludeSelectors: string;
}

/** App integration configuration */
export interface AppIntegrationConfig {
	/** Register as a plugin with the app */
	registerAsPlugin: boolean;
	/** Listen for app language change events */
	syncLanguage: boolean;
	/** Use app's text loader for fetching verse content */
	useAppTextLoader: boolean;
	/** Navigate using app's navigation system when clicking links */
	useAppNavigation: boolean;
}

/** Complete plugin configuration */
export interface VerseDetectionConfig {
	/** Base URL for the Browser Bible 4 application */
	appBaseUrl: string;
	/** Display mode for detected verses */
	displayMode: DisplayMode;
	/** Default Bible version/text ID for linking and fetching verse content */
	defaultTextId: string | null;
	/** Content source configuration */
	contentSource: ContentSourceConfig;
	/** Version linking configuration */
	versionLinking: VersionLinkingConfig;
	/** Popup configuration */
	popup: PopupConfig;
	/** Link configuration */
	link: LinkConfig;
	/** Styling options */
	styling: StylingConfig;
	/** Language detection options */
	language: LanguageConfig;
	/** Detection options */
	detection: DetectionConfig;
	/** Integration with Browser Bible 4 app */
	appIntegration: AppIntegrationConfig;
}

export const config: VerseDetectionConfig = {
	/**
	 * Base URL for the Browser Bible 4 application
	 * This is used to construct links to verses when linking to the main app.
	 * Examples:
	 *   - Local development: 'http://localhost:3000'
	 *   - Production: 'https://inscript.org'
	 *   - Relative to current domain: '/bible' or './'
	 * Default: inscript.org
	 */
	appBaseUrl: 'https://inscript.org',

	/**
	 * Display mode for detected verses
	 * - 'link': Create clickable links that navigate directly to the verse
	 * - 'popup': Show a hover popup with the verse text fetched from chapter files
	 * - 'both': Show popup on hover, navigate on click
	 */
	displayMode: 'both',

	/**
	 * Default Bible version/text ID for linking and fetching verse content
	 * This should match a text ID available in the app (e.g., 'webbe', 'kjv', 'asv')
	 * If null, will use the app's currently active text or first available
	 */
	defaultTextId: null,

	/**
	 * Content source configuration for fetching verse text in popups
	 */
	contentSource: {
		/**
		 * Source type for verse content
		 * - 'local': Fetch from local chapter files (Browser Bible content folder)
		 * - 'remote': Fetch from remote content server (e.g., inscript.bible.cloud)
		 * - 'app': Use the main app's TextLoader (when integrated)
		 */
		type: 'remote',

		/**
		 * Base URL for content files
		 * Remote: 'https://inscript.bible.cloud/content/texts'
		 * Local: './content/texts' or your local content folder
		 */
		baseUrl: 'https://inscript.bible.cloud/content/texts',

		/**
		 * URL to the texts index JSON file
		 * This file contains metadata about all available Bible versions
		 * Used to dynamically build the textIdsByLanguage mapping
		 */
		textsIndexUrl: 'https://inscript.bible.cloud/content/texts/texts.json',

		/**
		 * Default text/version ID for fetching chapter content
		 * This should match a text ID in the content folder (e.g., 'webbe', 'kjv')
		 * If null, will use language-specific default from textIdsByLanguage
		 */
		textId: null,

		/**
		 * Auto-select text ID based on detected language
		 * Uses textIdsByLanguage mapping (either from preferredTextIdsByLanguage or dynamically built)
		 */
		autoSelectByLanguage: true,

		/**
		 * Load available text IDs dynamically from the texts index JSON
		 * When true, fetches the texts index and builds textIdsByLanguage automatically
		 * Preferred versions (if specified) will be prioritized
		 */
		dynamicTextSelection: true,

		/**
		 * Preferred text IDs by language code (optional priority list)
		 * These versions will be selected if available for the given language.
		 * If not available, the first matching version from the texts index will be used.
		 * Can specify multiple IDs per language as an array for fallback order.
		 * Example: { 'en': ['ENGWEB', 'ENGKJV'], 'es': 'SPNRVG' }
		 */
		preferredTextIdsByLanguage: {
			'en': 'ENGWEB',    // World English Bible (preferred for English)
			'es': 'SPNRVG',    // Reina Valera Gomez (preferred for Spanish)
		},

		/**
		 * Computed text IDs by language code (auto-populated at runtime)
		 * This will be built dynamically from the texts index if dynamicTextSelection is true.
		 * Maps language codes to text IDs based on available versions.
		 * DO NOT manually edit - use preferredTextIdsByLanguage to set priorities.
		 */
		textIdsByLanguage: {},

		/**
		 * Chapter file path template
		 * Placeholders: {baseUrl}, {textId}, {sectionId}
		 */
		pathTemplate: '{baseUrl}/{textId}/{sectionId}.html'
	},

	/**
	 * Version linking configuration
	 * Controls how the Bible version is included in generated links
	 */
	versionLinking: {
		/**
		 * Include the Bible version in generated links
		 */
		includeVersion: true,

		/**
		 * URL parameter name for the Bible version
		 */
		versionParam: 'version',

		/**
		 * Allow override from the main app's configuration
		 */
		respectAppConfig: true
	},

	/**
	 * Popup configuration (when displayMode is 'popup' or 'both')
	 */
	popup: {
		/**
		 * Delay in milliseconds before showing the popup on hover
		 */
		showDelay: 300,

		/**
		 * Delay in milliseconds before hiding the popup when mouse leaves
		 */
		hideDelay: 200,

		/**
		 * Maximum width of the popup in pixels
		 */
		maxWidth: 450,

		/**
		 * Maximum height of the popup content in pixels
		 * The popup will expand dynamically up to this height, then become scrollable
		 * Set to a larger value to show more content before scrolling
		 */
		maxHeight: 400,

		/**
		 * Show verse numbers in the popup
		 */
		showVerseNumbers: true,

		/**
		 * Show the book and chapter reference as a header in the popup
		 */
		showHeader: true,

		/**
		 * Custom CSS class to add to the popup container
		 */
		cssClass: 'verse-popup',

		/**
		 * Position preference for the popup
		 * - 'auto': Automatically position based on available space
		 * - 'above': Always show above the reference
		 * - 'below': Always show below the reference
		 */
		position: 'auto',

		/**
		 * Enable loading indicator while fetching verse content
		 */
		showLoadingIndicator: true,

		/**
		 * Cache fetched verse content to avoid repeated requests
		 */
		cacheContent: true,

		/**
		 * Show the inscript.org logo in the popup header
		 * The logo links to inscript.org (or configured logoUrl)
		 */
		showLogo: true,

		/**
		 * URL the logo links to
		 */
		logoUrl: 'https://inscript.org',

		/**
		 * Show social media sharing buttons in popup footer
		 * When enabled, displays a row of share buttons below the footnotes area
		 * allowing users to share the verse on social media or copy to clipboard
		 */
		showSocialShare: false,

		/**
		 * Social share platforms to show (in order)
		 * Available platforms:
		 *   - 'facebook': Share on Facebook with verse text and link
		 *   - 'x': Share on X (Twitter) with verse text and link
		 *   - 'bluesky': Share on Bluesky with verse text and link
		 *   - 'copy': Copy verse text to clipboard
		 * Buttons appear in the order specified in this array
		 */
		socialSharePlatforms: ['facebook', 'x', 'bluesky', 'copy']
	},

	/**
	 * Link configuration (when displayMode is 'link' or 'both')
	 */
	link: {
		/**
		 * Custom URL template for verse links (optional)
		 * If set, overrides appBaseUrl-based URL generation
		 * Placeholders:
		 *   {ref} - Full reference (e.g., "John 3:16")
		 *   {book} - Book name (e.g., "John")
		 *   {bookCode} - Book code (e.g., "JN")
		 *   {chapter} - Chapter number (e.g., "3")
		 *   {verse} - Starting verse (e.g., "16")
		 *   {version} - Bible version/text ID
		 *   {sectionId} - Section ID (e.g., "JN3")
		 *   {fragmentId} - Fragment ID (e.g., "JN3_16")
		 * Example: 'https://bible.com/{version}/{bookCode}/{chapter}/{verse}'
		 * If null, uses appBaseUrl with standard Browser Bible URL format
		 */
		urlTemplate: null,

		/**
		 * URL parameter name for the verse reference
		 * Used when urlTemplate is null
		 */
		refParam: 'ref',

		/**
		 * CSS class to add to verse links
		 */
		cssClass: 'verse-link',

		/**
		 * Open links in new tab/window
		 */
		openInNewTab: false,

		/**
		 * Add data attributes to links for JavaScript handling
		 * Adds: data-verse-ref, data-book, data-chapter, data-verse, data-section-id
		 */
		addDataAttributes: true,

		/**
		 * Use hash-based navigation (e.g., #JN3_16 instead of ?ref=...)
		 * Compatible with Browser Bible's URL hash navigation
		 */
		useHashNavigation: true
	},

	/**
	 * Styling options
	 */
	styling: {
		/**
		 * Highlight detected verses with a background color
		 */
		highlightVerses: true,

		/**
		 * CSS class for highlighted verses
		 */
		highlightClass: 'verse-detected',

		/**
		 * Underline detected verses
		 */
		underline: true
	},

	/**
	 * Language detection options
	 */
	language: {
		/**
		 * Auto-detect language from HTML document
		 */
		autoDetect: true,

		/**
		 * Primary language to use (overrides auto-detection if set)
		 * Use language codes: 'en', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'hi', 'zh', 'id'
		 */
		primary: null,

		/**
		 * Additional languages to support alongside primary
		 * Useful for multilingual documents
		 */
		additional: [],

		/**
		 * Always include English as a fallback
		 */
		alwaysIncludeEnglish: true
	},

	/**
	 * Detection options
	 */
	detection: {
		/**
		 * Minimum book name length to match (helps avoid false positives)
		 */
		minBookNameLength: 2,

		/**
		 * Require chapter number (if false, "John" alone is valid)
		 */
		requireChapter: true,

		/**
		 * Allow chapter-only references like "Psalm 23" (no verse)
		 */
		allowChapterOnly: true,

		/**
		 * Elements to scan for verse references (CSS selectors)
		 * If null, will not auto-scan
		 */
		autoScanSelectors: null,

		/**
		 * Elements to exclude from scanning (CSS selectors)
		 */
		excludeSelectors: 'script, style, code, pre, .verse-popup, .no-verse-detect'
	},

	/**
	 * Integration with Browser Bible 4 app
	 */
	appIntegration: {
		/**
		 * Register as a plugin with the app
		 */
		registerAsPlugin: true,

		/**
		 * Listen for app language change events
		 */
		syncLanguage: true,

		/**
		 * Use app's text loader for fetching verse content
		 */
		useAppTextLoader: true,

		/**
		 * Navigate using app's navigation system when clicking links
		 */
		useAppNavigation: true
	}
};

/** Partial configuration for user overrides */
export type PartialVerseDetectionConfig = {
	[K in keyof VerseDetectionConfig]?: VerseDetectionConfig[K] extends object
		? Partial<VerseDetectionConfig[K]>
		: VerseDetectionConfig[K];
};

/**
 * Merge user configuration with defaults
 * @param userConfig - User-provided configuration
 * @returns Merged configuration
 */
export function mergeConfig(userConfig: PartialVerseDetectionConfig = {}): VerseDetectionConfig {
	return deepMerge(config, userConfig);
}

/**
 * Deep merge two objects
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
function deepMerge(target: VerseDetectionConfig, source: PartialVerseDetectionConfig): VerseDetectionConfig {
	const result: VerseDetectionConfig = { ...target };

	for (const key of Object.keys(source) as (keyof VerseDetectionConfig)[]) {
		const sourceValue = source[key];
		const targetValue = target[key];

		if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
			// Handle nested objects - use type assertion via unknown
			const merged = {
				...(targetValue as object || {}),
				...(sourceValue as object)
			};
			(result as unknown as Record<string, unknown>)[key] = merged;
		} else if (sourceValue !== undefined) {
			(result as unknown as Record<string, unknown>)[key] = sourceValue;
		}
	}

	return result;
}

export default config;
