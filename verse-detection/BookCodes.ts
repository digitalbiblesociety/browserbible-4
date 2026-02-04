/**
 * BookCodes Module
 *
 * Provides a mapping from canonical book names to short codes used in section IDs.
 * This is used for URL generation and content lookup.
 */

import type { CanonicalBookName } from './languages/types.js';

/** Book code type (2-letter abbreviation) */
export type BookCode = string;

/** Book code mapping from canonical names to short codes used in section IDs */
export const BOOK_CODES: Record<CanonicalBookName, BookCode> = {
	// Old Testament
	'Genesis': 'GN', 'Exodus': 'EX', 'Leviticus': 'LV', 'Numbers': 'NU',
	'Deuteronomy': 'DT', 'Joshua': 'JS', 'Judges': 'JG', 'Ruth': 'RT',
	'1 Samuel': 'S1', '2 Samuel': 'S2', '1 Kings': 'K1', '2 Kings': 'K2',
	'1 Chronicles': 'R1', '2 Chronicles': 'R2', 'Ezra': 'ER', 'Nehemiah': 'NH',
	'Esther': 'ES', 'Job': 'JB', 'Psalms': 'PS', 'Proverbs': 'PR',
	'Ecclesiastes': 'EC', 'Song of Solomon': 'SS', 'Isaiah': 'IS', 'Jeremiah': 'JR',
	'Lamentations': 'LM', 'Ezekiel': 'EK', 'Daniel': 'DN', 'Hosea': 'HO',
	'Joel': 'JL', 'Amos': 'AM', 'Obadiah': 'OB', 'Jonah': 'JH',
	'Micah': 'MC', 'Nahum': 'NM', 'Habakkuk': 'HK', 'Zephaniah': 'ZP',
	'Haggai': 'HG', 'Zechariah': 'ZC', 'Malachi': 'ML',
	// New Testament
	'Matthew': 'MT', 'Mark': 'MK', 'Luke': 'LK', 'John': 'JN',
	'Acts': 'AC', 'Romans': 'RM', '1 Corinthians': 'C1', '2 Corinthians': 'C2',
	'Galatians': 'GL', 'Ephesians': 'EP', 'Philippians': 'PP', 'Colossians': 'CL',
	'1 Thessalonians': 'H1', '2 Thessalonians': 'H2', '1 Timothy': 'T1', '2 Timothy': 'T2',
	'Titus': 'TT', 'Philemon': 'PM', 'Hebrews': 'HB', 'James': 'JM',
	'1 Peter': 'P1', '2 Peter': 'P2', '1 John': 'J1', '2 John': 'J2',
	'3 John': 'J3', 'Jude': 'JD', 'Revelation': 'RV'
};

/**
 * Get book code for a canonical book name
 * @param canonicalName - The canonical book name (e.g., "Genesis", "1 John")
 * @returns The 2-letter book code, or undefined if not found
 */
export function getBookCode(canonicalName: string): BookCode | undefined {
	return BOOK_CODES[canonicalName as CanonicalBookName];
}

export default BOOK_CODES;
