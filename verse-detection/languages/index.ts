/**
 * Language-specific book name patterns
 *
 * Usage options:
 *
 * 1. Import all languages (no tree-shaking):
 *    import { bookNamesByLanguage } from '@browserbible/verse-detection/languages';
 *
 * 2. Import specific languages (tree-shakeable):
 *    import en from '@browserbible/verse-detection/languages/en.json';
 *    import es from '@browserbible/verse-detection/languages/es.json';
 */

import type { BookNamePatterns, CanonicalBookName, LanguageCode } from './types.js';

// Re-export types
export type { BookNamePatterns, CanonicalBookName, LanguageCode } from './types.js';

// Import all language modules from JSON
import en from './en.json';
import es from './es.json';
import pt from './pt.json';
import fr from './fr.json';
import de from './de.json';
import ru from './ru.json';
import ar from './ar.json';
import hi from './hi.json';
import zh from './zh.json';
import id from './id.json';

// Re-export individual languages for selective imports
export { en, es, pt, fr, de, ru, ar, hi, zh, id };

/**
 * All book name patterns organized by language code
 */
export type BookNamesByLanguage = {
	[key in LanguageCode]: BookNamePatterns;
};

export const bookNamesByLanguage: BookNamesByLanguage = {
	en: en as BookNamePatterns,
	es: es as BookNamePatterns,
	pt: pt as BookNamePatterns,
	fr: fr as BookNamePatterns,
	de: de as BookNamePatterns,
	ru: ru as BookNamePatterns,
	ar: ar as BookNamePatterns,
	hi: hi as BookNamePatterns,
	zh: zh as BookNamePatterns,
	id: id as BookNamePatterns
};

/**
 * Get book patterns for a specific language
 */
export function getLanguagePatterns(languageCode: LanguageCode): BookNamePatterns {
	return bookNamesByLanguage[languageCode];
}

/**
 * Get all supported language codes
 */
export function getSupportedLanguages(): LanguageCode[] {
	return Object.keys(bookNamesByLanguage) as LanguageCode[];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(code: string): code is LanguageCode {
	return code in bookNamesByLanguage;
}

export default bookNamesByLanguage;
