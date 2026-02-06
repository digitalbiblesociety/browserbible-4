/**
 * VerseDetectionPlugin
 *
 * A standalone plugin for Browser Bible 4 that detects Bible verse references
 * in text using regular expressions. Supports both full book names (e.g., "John 3:16")
 * and common abbreviations (e.g., "Jhn 3:16", "Jn 3:16").
 *
 * Multi-language support for: English, Spanish, Portuguese, French, German,
 * Russian, Arabic, Hindi, Chinese, and Indonesian.
 *
 * The plugin automatically detects the document language from the HTML lang attribute
 * and loads the appropriate book name patterns.
 */

import {
	BOOK_NAMES,
	SUPPORTED_LANGUAGES,
	DEFAULT_LANGUAGE,
	getBookNames,
	getCombinedBookNames,
	type CanonicalBookName,
	type LanguageCode,
	type BookNamePatterns
} from './bookNames.js';

import {
	config as defaultConfig,
	mergeConfig,
	type VerseDetectionConfig,
	type PartialVerseDetectionConfig
} from './config.js';

import { VersePopup, type BrowserBibleApp } from './VersePopup.js';
import { BOOK_CODES } from './BookCodes.js';
import {
	getTextIdForLanguage as getTextIdForLanguageUtil,
	buildVerseUrl as buildVerseUrlUtil
} from './VerseUrlBuilder.js';

/** Parsed chapter information */
export interface ParsedChapter {
	chapter: number;
	verses: number[];
	startVerse?: number;
	endVerse?: number;
}

/** Parsed verse reference */
export interface ParsedVerseReference {
	original: string;
	book: string;
	bookVariation: string;
	detectedLanguage: string;
	reference: string;
	chapters: ParsedChapter[];
	startIndex: number;
	endIndex: number;
	version?: string;  // e.g., "KJV", "ESV", "NIV"
}

/** Variation lookup result */
interface VariationLookup {
	canonical: string;
	language: string;
}

/** Plugin options */
export interface VerseDetectionPluginOptions {
	language?: string;
	additionalLanguages?: string[] | 'all';
}

/** Plugin API interface */
export interface VerseDetectionPluginAPI {
	name: string;
	detectVerses: (text: string) => ParsedVerseReference[];
	containsVerses: (text: string) => boolean;
	replaceVerses: (text: string, formatter: (verse: ParsedVerseReference) => string) => string;
	linkVerses: (text: string, baseUrl?: string) => string;
	normalizeReference: (reference: string) => string | null;
	setLanguage: (newLanguages: string | string[]) => void;
	getCurrentLanguages: () => string[];
	getSupportedLanguages: () => string[];
	detectDocumentLanguage: () => string;
	getBookPatterns: () => Partial<Record<CanonicalBookName, string[]>>;
	getCanonicalBookName: (variation: string) => VariationLookup | null;
	getVerseRegex: () => RegExp;
}

/** Extended API with popup support */
export interface InitializedVerseDetection extends VerseDetectionPluginAPI {
	popup: VersePopup | null;
	config: VerseDetectionConfig;
	processText: (text: string) => string;
	processContainer: (container: HTMLElement) => void;
	setAvailableTextLanguages: (languages: string[] | Record<string, string> | null) => void;
	hasTextForLanguage: (lang: string) => boolean;
	destroy: () => void;
}

/**
 * Detect the current document language from HTML lang attribute
 * @returns Language code (e.g., 'en', 'es', 'zh')
 */
export function detectDocumentLanguage(): string {
	if (typeof document === 'undefined') {
		return DEFAULT_LANGUAGE;
	}

	// Try to get language from <html lang="...">
	const htmlLang = document.documentElement?.lang;
	if (htmlLang) {
		// Extract base language code (e.g., 'en' from 'en-US')
		return htmlLang.toLowerCase().split('-')[0];
	}

	// Fallback: check <meta> tags
	const metaLang = document.querySelector('meta[http-equiv="content-language"]') as HTMLMetaElement | null;
	if (metaLang?.content) {
		return metaLang.content.toLowerCase().split('-')[0];
	}

	// Final fallback: browser language
	if (typeof navigator !== 'undefined' && navigator.language) {
		return navigator.language.toLowerCase().split('-')[0];
	}

	return DEFAULT_LANGUAGE;
}

/**
 * Build a reverse lookup map from variations to canonical names and source language
 * @param bookPatterns - Book patterns mapping
 * @param languages - Languages used (in order)
 * @param bookNamesData - The full book names data by language
 * @returns Variation to {canonical, language} map
 */
function buildVariationMap(
	bookPatterns: Partial<Record<CanonicalBookName, string[]>>,
	languages: string[],
	bookNamesData: typeof BOOK_NAMES
): Map<string, VariationLookup> {
	const map = new Map<string, VariationLookup>();

	// Process languages in order so first match wins
	for (const lang of languages) {
		const langPatterns = bookNamesData[lang as LanguageCode];
		if (!langPatterns) continue;

		for (const [canonical, variations] of Object.entries(langPatterns) as [CanonicalBookName, string[]][]) {
			for (const variation of variations) {
				const key = variation.toLowerCase();
				// Only set if not already mapped (first language wins)
				if (!map.has(key)) {
					map.set(key, { canonical, language: lang });
				}
			}
		}
	}
	return map;
}

/**
 * Build the regex pattern for matching all book name variations
 * @param bookPatterns - Book patterns mapping
 * @returns Regex alternation pattern
 */
function buildBookPattern(bookPatterns: Partial<Record<CanonicalBookName, string[]>>): string {
	const allVariations: string[] = [];
	for (const variations of Object.values(bookPatterns)) {
		if (variations) {
			allVariations.push(...variations);
		}
	}
	// Sort by length descending to match longer patterns first (e.g., "1 Samuel" before "1 Sam")
	allVariations.sort((a, b) => b.length - a.length);
	// Escape special regex characters and join with alternation
	const escaped = allVariations.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return escaped.join('|');
}

/**
 * Create the full verse reference regex pattern
 * Matches patterns like:
 * - John 3:16
 * - Jhn 3:16
 * - 1 John 2:3-4
 * - Genesis 1:1-2:3
 * - Ps 23
 * - Matt 5:3, 6, 9
 * - 约翰福音 3:16 (Chinese)
 * - Матфей 5:3 (Russian)
 *
 * @param bookPatterns - Book patterns mapping
 * @returns Compiled regex
 */
function buildVerseRegex(bookPatterns: Partial<Record<CanonicalBookName, string[]>>): RegExp {
	const bookPattern = buildBookPattern(bookPatterns);

	// Chapter and verse pattern components
	const chapter = '\\d{1,3}';
	const verse = '\\d{1,3}';
	const verseRange = `${verse}(?:\\s*[-\u2013\u2014]\\s*${verse})?`; // 3-4 or 3–4 or 3—4
	const verseList = `${verseRange}(?:\\s*,\\s*${verseRange})*`; // 3-4, 6, 9-10
	const chapterVerse = `${chapter}(?:\\s*[:.;]\\s*${verseList})?`; // 3:16 or just 3 (chapter only)
	const chapterRange = `${chapterVerse}(?:\\s*[-\u2013\u2014]\\s*${chapterVerse})?`; // 1:1-2:3

	// Optional parenthesized version suffix like (KJV), (ESV), (WEB)
	const versionSuffix = '(?:\\s*\\(([A-Za-z0-9]{2,10})\\))?';

	// Full pattern: BookName + space + chapter/verse reference + optional version
	// Use Unicode word boundaries for multi-language support
	// Allow for various spacing and punctuation contexts
	const fullPattern = `(?:^|[\\s(\\[{،。、])((${bookPattern})\\.?\\s*(${chapterRange})${versionSuffix})(?=[\\s.,;:!?)\\]}،。、]|$)`;

	return new RegExp(fullPattern, 'giu');
}

/**
 * Parse a detected verse reference into structured data
 * @param match - Regex match array
 * @param variationMap - Variation to {canonical, language} map
 * @returns Parsed verse reference
 */
function parseVerseReference(match: RegExpExecArray, variationMap: Map<string, VariationLookup>): ParsedVerseReference {
	const fullMatch = match[1];
	const bookMatch = match[2];
	const referenceMatch = match[3];
	const versionMatch = match[4];

	const lookupResult = variationMap.get(bookMatch.toLowerCase().replace(/\.$/, ''));

	// Parse the chapter:verse reference
	const parsed: ParsedVerseReference = {
		original: fullMatch,
		book: lookupResult?.canonical || bookMatch,
		bookVariation: bookMatch.replace(/\.$/, ''),
		detectedLanguage: lookupResult?.language || 'en',
		reference: referenceMatch,
		chapters: [],
		startIndex: match.index + (match[0].length - match[1].length),
		endIndex: match.index + match[0].length,
		version: versionMatch || undefined
	};

	// Parse chapter and verse numbers
	if (referenceMatch) {
		const chapterVersePattern = /(\d{1,3})(?:\s*[:.;]\s*(\d{1,3}(?:\s*[-\u2013\u2014]\s*\d{1,3})?))?/g;
		let cvMatch: RegExpExecArray | null;
		while ((cvMatch = chapterVersePattern.exec(referenceMatch)) !== null) {
			const chapter: ParsedChapter = {
				chapter: parseInt(cvMatch[1], 10),
				verses: []
			};
			if (cvMatch[2]) {
				// Parse verses (could be range like 3-4 or single)
				const verseParts = cvMatch[2].split(/\s*[-\u2013\u2014]\s*/);
				if (verseParts.length === 2) {
					chapter.startVerse = parseInt(verseParts[0], 10);
					chapter.endVerse = parseInt(verseParts[1], 10);
				} else {
					chapter.startVerse = parseInt(verseParts[0], 10);
					chapter.endVerse = chapter.startVerse;
				}
			}
			parsed.chapters.push(chapter);
		}
	}

	return parsed;
}

/**
 * Main VerseDetectionPlugin factory function
 * @param app - Browser Bible 4 app instance (optional)
 * @param options - Configuration options
 * @returns Plugin API
 */
export function VerseDetectionPlugin(
	app: BrowserBibleApp | null,
	options: VerseDetectionPluginOptions = {}
): VerseDetectionPluginAPI {
	// Determine language(s) to use
	let primaryLanguage = options.language || detectDocumentLanguage();

	// Validate primary language
	if (!SUPPORTED_LANGUAGES.includes(primaryLanguage as LanguageCode)) {
		console.warn(`VerseDetectionPlugin: Unsupported language '${primaryLanguage}', falling back to English`);
		primaryLanguage = DEFAULT_LANGUAGE;
	}

	// Build language list
	const languages: string[] = [primaryLanguage];
	if (options.additionalLanguages) {
		// Support 'all' to load all supported languages
		if (options.additionalLanguages === 'all') {
			for (const lang of SUPPORTED_LANGUAGES) {
				if (!languages.includes(lang)) {
					languages.push(lang);
				}
			}
		} else {
			for (const lang of options.additionalLanguages) {
				if (SUPPORTED_LANGUAGES.includes(lang as LanguageCode) && !languages.includes(lang)) {
					languages.push(lang);
				}
			}
		}
	}

	// Always include English as fallback if not already included
	if (!languages.includes('en')) {
		languages.push('en');
	}

	// Get combined book patterns for all selected languages
	const bookPatterns = getCombinedBookNames(languages);
	const variationMap = buildVariationMap(bookPatterns, languages, BOOK_NAMES);

	// Current state
	let currentLanguages = [...languages];

	/**
	 * Rebuild patterns for a new language configuration
	 * @param newLanguages - New language(s) to use
	 */
	function setLanguage(newLanguages: string | string[]): void {
		const langArray = Array.isArray(newLanguages) ? newLanguages : [newLanguages];
		const validLangs = langArray.filter(l => SUPPORTED_LANGUAGES.includes(l as LanguageCode));

		if (validLangs.length === 0) {
			console.warn('VerseDetectionPlugin: No valid languages provided');
			return;
		}

		// Always include English
		if (!validLangs.includes('en')) {
			validLangs.push('en');
		}

		currentLanguages = validLangs;

		// Rebuild variation map with language tracking
		variationMap.clear();
		for (const lang of currentLanguages) {
			const langPatterns = BOOK_NAMES[lang as LanguageCode];
			if (!langPatterns) continue;

			for (const [canonical, variations] of Object.entries(langPatterns) as [CanonicalBookName, string[]][]) {
				for (const variation of variations) {
					const key = variation.toLowerCase();
					if (!variationMap.has(key)) {
						variationMap.set(key, { canonical, language: lang });
					}
				}
			}
		}
	}

	/**
	 * Get fresh regex with current patterns
	 * @returns Compiled verse regex
	 */
	function getRegex(): RegExp {
		const patterns = getCombinedBookNames(currentLanguages);
		return buildVerseRegex(patterns);
	}

	/**
	 * Detect all verse references in a given text
	 * @param text - The text to search for verse references
	 * @returns Array of parsed verse reference objects
	 */
	function detectVerses(text: string): ParsedVerseReference[] {
		if (!text || typeof text !== 'string') {
			return [];
		}

		const results: ParsedVerseReference[] = [];
		const regex = getRegex();
		let match: RegExpExecArray | null;

		while ((match = regex.exec(text)) !== null) {
			const parsed = parseVerseReference(match, variationMap);
			results.push(parsed);
		}

		return results;
	}

	/**
	 * Replace verse references in text with linked/formatted versions
	 * @param text - The text to process
	 * @param formatter - Function(parsedRef) that returns replacement string
	 * @returns Text with verse references replaced
	 */
	function replaceVerses(text: string, formatter: (verse: ParsedVerseReference) => string): string {
		if (!text || typeof text !== 'string') {
			return text;
		}

		const verses = detectVerses(text);
		if (verses.length === 0) {
			return text;
		}

		// Process in reverse order to preserve string indices
		let result = text;
		for (let i = verses.length - 1; i >= 0; i--) {
			const verse = verses[i];
			const replacement = formatter(verse);
			result = result.slice(0, verse.startIndex) + replacement + result.slice(verse.endIndex);
		}

		return result;
	}

	/**
	 * Create HTML links for detected verses
	 * @param text - The text to process
	 * @param baseUrl - Base URL for links (default uses app navigation)
	 * @returns HTML with verse links
	 */
	function linkVerses(text: string, baseUrl: string = ''): string {
		return replaceVerses(text, (verse) => {
			const href = baseUrl
				? `${baseUrl}?ref=${encodeURIComponent(verse.book + ' ' + verse.reference)}`
				: `javascript:void(0)`;
			const dataRef = `${verse.book} ${verse.reference}`;
			return `<a href="${href}" class="verse-link" data-verse-ref="${dataRef}">${verse.original}</a>`;
		});
	}

	/**
	 * Normalize a verse reference string to canonical form
	 * @param reference - A verse reference string like "Jhn 3:16"
	 * @returns Canonical form like "John 3:16" or null if not valid
	 */
	function normalizeReference(reference: string): string | null {
		const verses = detectVerses(reference);
		if (verses.length === 0) {
			return null;
		}
		const first = verses[0];
		return `${first.book} ${first.reference}`;
	}

	/**
	 * Check if a string contains any verse references
	 * @param text - The text to check
	 * @returns boolean
	 */
	function containsVerses(text: string): boolean {
		if (!text || typeof text !== 'string') {
			return false;
		}
		const regex = getRegex();
		return regex.test(text);
	}

	/**
	 * Get all supported book names and their variations for current languages
	 * @returns Book patterns mapping
	 */
	function getBookPatterns(): Partial<Record<CanonicalBookName, string[]>> {
		return getCombinedBookNames(currentLanguages);
	}

	/**
	 * Get the canonical name for a book variation
	 * @param variation - A book name or abbreviation
	 * @returns Canonical book name or null
	 */
	function getCanonicalBookName(variation: string): VariationLookup | null {
		return variationMap.get(variation.toLowerCase()) || null;
	}

	/**
	 * Get current active languages
	 * @returns Array of language codes
	 */
	function getCurrentLanguages(): string[] {
		return [...currentLanguages];
	}

	/**
	 * Get all supported languages
	 * @returns Array of supported language codes
	 */
	function getSupportedLanguages(): string[] {
		return [...SUPPORTED_LANGUAGES];
	}

	// Plugin API
	const api: VerseDetectionPluginAPI = {
		name: 'VerseDetectionPlugin',

		// Core detection methods
		detectVerses,
		containsVerses,

		// Transformation methods
		replaceVerses,
		linkVerses,
		normalizeReference,

		// Language methods
		setLanguage,
		getCurrentLanguages,
		getSupportedLanguages,
		detectDocumentLanguage,

		// Utility methods
		getBookPatterns,
		getCanonicalBookName,

		// Access to internal regex for advanced use
		getVerseRegex: getRegex
	};

	// If app is provided, set up integration
	if (app) {
		// Watch for language changes in the app
		if (typeof app.on === 'function') {
			app.on('languagechange', (lang: string) => {
				if (lang && SUPPORTED_LANGUAGES.includes(lang as LanguageCode)) {
					setLanguage([lang, 'en']);
				}
			});
		}
	}

	return api;
}

/**
 * Create a standalone verse detector with optional language configuration
 * @param options - Configuration options
 * @returns Verse detector API
 */
export const createVerseDetector = (options: VerseDetectionPluginOptions = {}): VerseDetectionPluginAPI =>
	VerseDetectionPlugin(null, options);

/**
 * Initialize the full verse detection system with popup support
 * @param app - Browser Bible 4 app instance
 * @param userConfig - User configuration options
 * @returns Initialized plugin with popup system
 */
export async function initVerseDetection(
	app: BrowserBibleApp | null = null,
	userConfig: PartialVerseDetectionConfig = {}
): Promise<InitializedVerseDetection> {
	// Import config and popup modules
	const { config, mergeConfig } = await import('./config.js');
	const { VersePopup } = await import('./VersePopup.js');

	// Merge user config with defaults
	const finalConfig = mergeConfig(userConfig);

	// Create the detector
	const detectorOptions: VerseDetectionPluginOptions = {
		language: finalConfig.language.autoDetect ? undefined : (finalConfig.language.primary || undefined),
		additionalLanguages: finalConfig.language.additional
	};
	const detector = VerseDetectionPlugin(app, detectorOptions);

	// Create popup instance if needed
	let popup: VersePopup | null = null;
	if (finalConfig.displayMode === 'popup' || finalConfig.displayMode === 'both') {
		popup = new VersePopup(finalConfig);
		await popup.init(app ?? undefined);
	}

	/**
	 * Get text ID for a specific language
	 * @param lang - Language code
	 * @returns Text ID for the language
	 */
	function getTextIdForLanguage(lang: string): string {
		const contentConfig = finalConfig.contentSource;
		const textIdsByLanguage = contentConfig?.textIdsByLanguage || {};
		return getTextIdForLanguageUtil(lang, textIdsByLanguage, finalConfig.defaultTextId);
	}

	/**
	 * Build URL for a verse reference
	 * @param verse - Parsed verse reference
	 * @returns URL for the verse
	 */
	function buildVerseUrl(verse: ParsedVerseReference): string {
		return buildVerseUrlUtil({
			book: verse.book,
			reference: verse.reference,
			detectedLanguage: verse.detectedLanguage,
			version: verse.version
		}, finalConfig);
	}

	// Track which languages have available texts (for skipping links)
	let availableTextLanguages: Set<string> | null = null; // null means all languages allowed

	/**
	 * Process text and return HTML with verse links/highlights
	 * @param text - Text to process
	 * @returns Processed HTML
	 */
	function processText(text: string): string {
		const mode = finalConfig.displayMode;
		const linkConfig = finalConfig.link;
		const stylingConfig = finalConfig.styling;

		return detector.replaceVerses(text, (verse) => {
			// Check if there's available text for this language
			const detectedLang = verse.detectedLanguage || 'en';
			if (availableTextLanguages && !availableTextLanguages.has(detectedLang)) {
				// No text available for this language - return original text unchanged
				return verse.original;
			}

			const classes = [linkConfig.cssClass];
			if (stylingConfig.highlightVerses) {
				classes.push(stylingConfig.highlightClass);
			}

			// Get book code and IDs for data attributes
			const bookCode = BOOK_CODES[verse.book] || '';
			const chapterMatch = verse.reference?.match(/^(\d+)/);
			const verseMatch = verse.reference?.match(/:(\d+)/);
			const chapter = chapterMatch ? chapterMatch[1] : '';
			const verseNum = verseMatch ? verseMatch[1] : '';
			const sectionId = bookCode && chapter ? `${bookCode}${chapter}` : '';

			const versionAttr = verse.version ? ` data-version="${verse.version}"` : '';
			const dataAttrs = linkConfig.addDataAttributes
				? `data-verse-ref="${verse.book} ${verse.reference}" data-book="${verse.book}" data-book-code="${bookCode}" data-chapter="${chapter}" data-verse="${verseNum}" data-section-id="${sectionId}" data-detected-lang="${detectedLang}"${versionAttr}`
				: '';

			let href = 'javascript:void(0)';
			if (mode === 'link' || mode === 'both') {
				href = buildVerseUrl(verse);
			}

			const target = linkConfig.openInNewTab ? ' target="_blank" rel="noopener"' : '';
			const style = stylingConfig.underline ? '' : ' style="text-decoration:none"';

			return `<a href="${href}" class="${classes.join(' ')}" ${dataAttrs}${target}${style}>${verse.original}</a>`;
		});
	}

	/**
	 * Process and attach popup handlers to a container
	 * @param container - Container element
	 */
	function processContainer(container: HTMLElement): void {
		// Find text nodes and process them
		const walker = document.createTreeWalker(
			container,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode: (node: Text) => {
					// Skip excluded elements
					const parent = node.parentElement;
					if (!parent) return NodeFilter.FILTER_REJECT;

					const excludeSelectors = finalConfig.detection.excludeSelectors;
					if (excludeSelectors && parent.closest(excludeSelectors)) {
						return NodeFilter.FILTER_REJECT;
					}

					// Skip if no verse references
					if (!detector.containsVerses(node.textContent || '')) {
						return NodeFilter.FILTER_REJECT;
					}

					return NodeFilter.FILTER_ACCEPT;
				}
			}
		);

		const nodesToProcess: Text[] = [];
		let node: Node | null;
		while ((node = walker.nextNode())) {
			nodesToProcess.push(node as Text);
		}

		// Process nodes (replace text with HTML)
		nodesToProcess.forEach((textNode) => {
			const html = processText(textNode.textContent || '');
			const span = document.createElement('span');
			span.innerHTML = html;
			textNode.parentNode?.replaceChild(span, textNode);
		});

		// Attach popup handlers
		if (popup) {
			popup.attach(container);
		}
	}

	/**
	 * Set which languages have available Bible texts
	 * Verses in other languages will be detected but not linked
	 * @param languages - Array of language codes or textIdsByLanguage object
	 */
	function setAvailableTextLanguages(languages: string[] | Record<string, string> | null): void {
		if (Array.isArray(languages)) {
			availableTextLanguages = new Set(languages);
		} else if (languages && typeof languages === 'object') {
			// If passed a textIdsByLanguage object, extract the keys AND update the config
			availableTextLanguages = new Set(Object.keys(languages));
			// Also update the textIdsByLanguage mapping so URLs point to correct versions
			finalConfig.contentSource.textIdsByLanguage = { ...languages };
		} else {
			availableTextLanguages = null;
		}
	}

	/**
	 * Check if a language has available Bible text
	 * @param lang - Language code
	 * @returns boolean
	 */
	function hasTextForLanguage(lang: string): boolean {
		if (!availableTextLanguages) return true; // No restrictions
		return availableTextLanguages.has(lang);
	}

	// Return enhanced API
	return {
		...detector,
		popup,
		config: finalConfig,
		processText,
		processContainer,
		setAvailableTextLanguages,
		hasTextForLanguage,

		/**
		 * Destroy the plugin and clean up
		 */
		destroy(): void {
			if (popup) {
				popup.destroy();
			}
		}
	};
}

// Re-export book name utilities for external use
export {
	BOOK_NAMES,
	SUPPORTED_LANGUAGES,
	DEFAULT_LANGUAGE,
	getBookNames,
	getCombinedBookNames
};

export default VerseDetectionPlugin;
