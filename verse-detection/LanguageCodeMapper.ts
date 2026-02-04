/**
 * LanguageCodeMapper Module
 *
 * Handles language code normalization and text ID mapping by language.
 * Provides utilities for converting between ISO 639-3 (3-letter) and ISO 639-1 (2-letter) codes.
 */

import type { TextInfo } from './VersePopup.js';

/** Mapping from 3-letter ISO 639-3 codes to 2-letter ISO 639-1 codes */
const ISO_639_3_TO_1: Record<string, string> = {
	'eng': 'en', 'spa': 'es', 'por': 'pt', 'fra': 'fr', 'deu': 'de',
	'rus': 'ru', 'ara': 'ar', 'hin': 'hi', 'zho': 'zh', 'cmn': 'zh',
	'ind': 'id', 'ita': 'it', 'nld': 'nl', 'pol': 'pl', 'kor': 'ko',
	'jpn': 'ja', 'vie': 'vi', 'tha': 'th', 'tur': 'tr', 'ukr': 'uk',
	'swe': 'sv', 'nor': 'no', 'dan': 'da', 'fin': 'fi', 'ces': 'cs',
	'ell': 'el', 'heb': 'he', 'hun': 'hu', 'ron': 'ro', 'bul': 'bg'
};

/** Mapping from language names to 2-letter codes (for fallback) */
const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
	'english': 'en', 'spanish': 'es', 'portuguese': 'pt', 'french': 'fr',
	'german': 'de', 'russian': 'ru', 'arabic': 'ar', 'hindi': 'hi',
	'chinese': 'zh', 'indonesian': 'id', 'italian': 'it', 'dutch': 'nl'
};

/** Display names for language codes */
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
	'en': 'English', 'es': 'Spanish', 'pt': 'Portuguese', 'fr': 'French',
	'de': 'German', 'ru': 'Russian', 'ar': 'Arabic', 'hi': 'Hindi',
	'zh': 'Chinese', 'id': 'Indonesian', 'it': 'Italian', 'nl': 'Dutch',
	'pl': 'Polish', 'ko': 'Korean', 'ja': 'Japanese', 'vi': 'Vietnamese',
	'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'sv': 'Swedish',
	'no': 'Norwegian', 'da': 'Danish', 'fi': 'Finnish', 'cs': 'Czech',
	'el': 'Greek', 'he': 'Hebrew', 'hu': 'Hungarian', 'ro': 'Romanian',
	'bg': 'Bulgarian'
};

/**
 * Normalize a 3-letter ISO 639-3 language code to 2-letter ISO 639-1
 * Also handles language names as fallback
 * @param lang3 - 3-letter language code (e.g., 'eng', 'spa')
 * @param langName - Language name as fallback
 * @returns 2-letter language code (e.g., 'en', 'es'), or null if not mappable
 */
export function normalizeLangCode(lang3: string | undefined, langName?: string): string | null {
	// Try direct 3-letter to 2-letter mapping
	if (lang3 && ISO_639_3_TO_1[lang3.toLowerCase()]) {
		return ISO_639_3_TO_1[lang3.toLowerCase()];
	}

	// Fallback: try to extract from language name
	if (langName) {
		const normalized = langName.toLowerCase();
		for (const [name, code] of Object.entries(LANGUAGE_NAME_TO_CODE)) {
			if (normalized.includes(name)) {
				return code;
			}
		}
	}

	// Return the 3-letter code as-is if we can't map it
	return lang3?.toLowerCase() || null;
}

/**
 * Get display name for a language code
 * @param langCode - 2-letter language code
 * @returns Display name (e.g., "English" for "en")
 */
export function getLanguageName(langCode: string | null | undefined): string {
	return LANGUAGE_DISPLAY_NAMES[langCode || ''] || langCode || 'this language';
}

/**
 * Build textIdsByLanguage mapping from texts index data
 * Groups texts by language and selects the best text ID for each language
 *
 * @param textsData - Array of text info objects from texts index
 * @param preferredIds - Preferred text IDs by language code
 * @returns Mapping from language code to text ID
 */
export function buildTextIdsByLanguage(
	textsData: TextInfo[] | null | undefined,
	preferredIds: Record<string, string | string[]> = {}
): Record<string, string> {
	if (!textsData || !Array.isArray(textsData)) {
		return {};
	}

	const mapping: Record<string, string> = {};

	// Group texts by language code
	const textsByLanguage = new Map<string, TextInfo[]>();

	for (const textInfo of textsData) {
		// Skip non-Bible texts (commentaries, etc.)
		const textType = textInfo.type || 'bible';
		if (textType !== 'bible') continue;

		// Skip texts without content
		if (textInfo.hasText === false) continue;

		// Get language code from lang property (3-letter ISO 639-3)
		// or derive from langName/langNameEnglish
		const langCode = normalizeLangCode(textInfo.lang, textInfo.langNameEnglish || textInfo.langName);

		if (!langCode) continue;

		if (!textsByLanguage.has(langCode)) {
			textsByLanguage.set(langCode, []);
		}
		textsByLanguage.get(langCode)!.push(textInfo);
	}

	// Build mapping for each language
	for (const [langCode, texts] of textsByLanguage) {
		// Check if there's a preferred version for this language
		const preferredForLang = preferredIds[langCode];
		let selectedTextId: string | null = null;

		if (preferredForLang) {
			// Handle both single ID and array of IDs
			const idsToCheck = Array.isArray(preferredForLang) ? preferredForLang : [preferredForLang];

			for (const prefId of idsToCheck) {
				const found = texts.find(t => t.id === prefId || t.id.toUpperCase() === prefId.toUpperCase());
				if (found) {
					selectedTextId = found.id;
					break;
				}
			}
		}

		// If no preferred version found or available, use the first one
		if (!selectedTextId && texts.length > 0) {
			// Sort by name for consistency
			texts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
			selectedTextId = texts[0].id;
		}

		if (selectedTextId) {
			mapping[langCode] = selectedTextId;
		}
	}

	return mapping;
}

export {
	ISO_639_3_TO_1,
	LANGUAGE_NAME_TO_CODE,
	LANGUAGE_DISPLAY_NAMES
};
