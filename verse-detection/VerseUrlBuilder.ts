/**
 * VerseUrlBuilder Module
 *
 * Handles URL generation for verse references and text ID selection.
 */

import { BOOK_CODES } from './BookCodes.js';
import type { VerseDetectionConfig } from './config.js';

/** Parsed verse reference for URL building */
export interface VerseReferenceForUrl {
	book: string;
	reference: string;
	detectedLanguage?: string;
}

/** Configuration for text ID selection */
export interface TextIdConfig {
	textId?: string;
	textIdsByLanguage?: Record<string, string>;
	autoSelectByLanguage?: boolean;
}

/** Full config needed for getTextId */
export interface GetTextIdConfig {
	contentSource?: TextIdConfig;
	defaultTextId?: string | null;
	language?: {
		primary?: string;
	};
}

/**
 * Get text ID for a specific language (simple version)
 * Used by VerseDetectionPlugin for URL generation
 *
 * @param lang - Language code
 * @param textIdsByLanguage - Map of language codes to text IDs
 * @param defaultTextId - Default text ID fallback
 * @returns Text ID for the language, or empty string if not found
 */
export function getTextIdForLanguage(
	lang: string,
	textIdsByLanguage: Record<string, string>,
	defaultTextId?: string | null
): string {
	// Try the specific language first
	if (textIdsByLanguage[lang]) {
		return textIdsByLanguage[lang];
	}

	// Fall back to default text ID
	if (defaultTextId) {
		return defaultTextId;
	}

	// Fall back to English
	if (textIdsByLanguage['en']) {
		return textIdsByLanguage['en'];
	}

	return '';
}

/**
 * Get text ID based on configuration and language (full version)
 * Used by VersePopup for content fetching with more complex fallback logic
 *
 * @param detectedLang - Detected language to use for text selection
 * @param config - Configuration object
 * @returns Text ID or null if none available for the language
 */
export function getTextId(
	detectedLang: string | null = null,
	config: GetTextIdConfig
): string | null {
	const contentConfig = config.contentSource;
	const textIdsByLanguage = contentConfig?.textIdsByLanguage || {};

	// If explicit textId is set (no auto-selection), use it
	if (contentConfig?.textId && !detectedLang) {
		return contentConfig.textId;
	}

	// If we have a detected language, try to find a matching text
	if (detectedLang && textIdsByLanguage[detectedLang]) {
		return textIdsByLanguage[detectedLang];
	}

	// If detected language has no text available, return null (don't fall back)
	if (detectedLang && !textIdsByLanguage[detectedLang]) {
		return null;
	}

	// Fall back to configured defaultTextId
	if (config.defaultTextId) {
		return config.defaultTextId;
	}

	// Auto-select based on primary language
	if (contentConfig?.autoSelectByLanguage) {
		const langConfig = config.language;
		const language = langConfig?.primary || 'en';

		// Try exact language match first
		if (textIdsByLanguage[language]) {
			return textIdsByLanguage[language];
		}

		// Try English fallback
		if (textIdsByLanguage['en']) {
			return textIdsByLanguage['en'];
		}

		// Try any available language as last resort
		const availableLanguages = Object.keys(textIdsByLanguage);
		if (availableLanguages.length > 0) {
			return textIdsByLanguage[availableLanguages[0]];
		}
	}

	// No text available
	return null;
}

/**
 * Build URL for a verse reference
 *
 * @param verse - Parsed verse reference
 * @param config - Detection configuration
 * @returns URL for the verse
 */
export function buildVerseUrl(
	verse: VerseReferenceForUrl,
	config: VerseDetectionConfig
): string {
	const linkConfig = config.link;
	const appBaseUrl = config.appBaseUrl || '';
	const textIdsByLanguage = config.contentSource?.textIdsByLanguage || {};

	// Use detected language to get appropriate text ID
	const textId = getTextIdForLanguage(
		verse.detectedLanguage || 'en',
		textIdsByLanguage,
		config.defaultTextId
	);

	// Parse chapter and verse from reference
	const chapterMatch = verse.reference?.match(/^(\d+)/);
	const verseMatch = verse.reference?.match(/:(\d+)/);
	const chapter = chapterMatch ? chapterMatch[1] : '';
	const verseNum = verseMatch ? verseMatch[1] : '';

	// Get book code
	const bookCode = BOOK_CODES[verse.book] || '';
	const sectionId = bookCode && chapter ? `${bookCode}${chapter}` : '';
	const fragmentId = sectionId && verseNum ? `${sectionId}_${verseNum}` : sectionId;

	// If custom URL template is provided, use it
	if (linkConfig.urlTemplate) {
		return linkConfig.urlTemplate
			.replace('{ref}', encodeURIComponent(`${verse.book} ${verse.reference}`))
			.replace('{book}', encodeURIComponent(verse.book))
			.replace('{bookCode}', bookCode)
			.replace('{chapter}', chapter)
			.replace('{verse}', verseNum)
			.replace('{version}', textId)
			.replace('{sectionId}', sectionId)
			.replace('{fragmentId}', fragmentId);
	}

	// Build URL using appBaseUrl
	let url = appBaseUrl;

	// Add version parameter if configured
	if (config.versionLinking?.includeVersion && textId) {
		const versionParam = config.versionLinking.versionParam || 'version';
		url += url.includes('?') ? '&' : '?';
		url += `${versionParam}=${encodeURIComponent(textId)}`;
	}

	// Add verse reference using hash navigation or query param
	if (linkConfig.useHashNavigation && fragmentId) {
		url += `#${fragmentId}`;
	} else {
		const refParam = linkConfig.refParam || 'ref';
		url += url.includes('?') ? '&' : '?';
		url += `${refParam}=${encodeURIComponent(`${verse.book} ${verse.reference}`)}`;
	}

	return url || 'javascript:void(0)';
}
