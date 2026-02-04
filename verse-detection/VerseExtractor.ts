/**
 * VerseExtractor Module
 *
 * Handles extracting verses from chapter HTML and processing verse content.
 * Manages footnote extraction and formatting.
 */

import type { ParsedReference } from './VersePopup.js';

/** Extracted footnote data */
export interface ExtractedFootnote {
	key: string;
	text: string;
}

/** Result of verse extraction */
export interface ExtractedVerseResult {
	content: string;
	footnotes: ExtractedFootnote[];
}

/** Configuration for verse extraction */
export interface VerseExtractorConfig {
	showVerseNumbers: boolean;
}

/**
 * Process verse content - extracts footnotes and returns cleaned verse HTML
 * @param verseEl - The verse element to process
 * @param footnotes - Array to collect extracted footnotes into
 * @returns Cleaned HTML string with footnote markers
 */
export function processVerseContent(verseEl: HTMLElement, footnotes: ExtractedFootnote[]): string {
	// Clone the element to avoid modifying the original
	const clone = verseEl.cloneNode(true) as HTMLElement;

	// Remove verse number elements if they exist (we add our own)
	clone.querySelectorAll('.v-num, .verse-num').forEach(el => el.remove());

	// Extract footnotes and replace with markers
	clone.querySelectorAll('.note, .cf').forEach(note => {
		// Get the key (footnote marker)
		const keyEl = note.querySelector('.key');
		const key = keyEl?.textContent?.trim() || '*';

		// Get the footnote text
		const textEl = note.querySelector('.text');
		let text = '';

		if (textEl) {
			text = textEl.innerHTML.trim();
		} else {
			// Collect text content that's not the key
			const textParts: string[] = [];
			note.childNodes.forEach(child => {
				if (child !== keyEl) {
					if (child.nodeType === Node.TEXT_NODE) {
						const t = child.textContent?.trim();
						if (t) textParts.push(t);
					} else if (child.nodeType === Node.ELEMENT_NODE) {
						textParts.push((child as HTMLElement).innerHTML || child.textContent || '');
					}
				}
			});
			text = textParts.join(' ').trim();
		}

		// Store the footnote if it has content
		if (text) {
			footnotes.push({ key, text });
		}

		// Replace the note element with just a marker
		const marker = document.createElement('span');
		marker.className = 'note-marker';
		marker.textContent = key;
		note.parentNode?.replaceChild(marker, note);
	});

	return clone.innerHTML.trim();
}

/**
 * Extract specific verses from chapter HTML
 * @param html - Full chapter HTML content
 * @param parsed - Parsed verse reference
 * @param config - Extraction configuration
 * @returns Extracted verse content and footnotes
 */
export function extractVerses(
	html: string,
	parsed: ParsedReference,
	config: VerseExtractorConfig
): ExtractedVerseResult {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const footnotes: ExtractedFootnote[] = [];

	if (!parsed.startVerse) {
		// Return entire chapter content if no verse specified
		// Get all verses in the chapter and combine them
		const section = doc.querySelector('.section');
		if (section) {
			// Get all verse elements
			const verseEls = section.querySelectorAll('.v');
			if (verseEls.length > 0) {
				const verses: string[] = [];
				verseEls.forEach((verseEl, index) => {
					const verseNum = config.showVerseNumbers
						? `<span class="v-num">${index + 1}</span>`
						: '';
					// Preserve HTML content including footnotes
					const verseContent = processVerseContent(verseEl as HTMLElement, footnotes);
					verses.push(`${verseNum}<span class="v">${verseContent}</span>`);
				});
				return { content: verses.join(' '), footnotes };
			}
		}
		// Fallback: just get first verse
		const firstVerse = doc.querySelector('.v');
		const content = firstVerse ? processVerseContent(firstVerse as HTMLElement, footnotes) : '';
		return { content, footnotes };
	}

	const verses: string[] = [];
	const start = parsed.startVerse;
	const end = parsed.endVerse || start;

	for (let v = start; v <= end; v++) {
		const verseId = `${parsed.sectionId}_${v}`;
		const verseEl = doc.querySelector(`[data-id="${verseId}"], .${verseId}`);

		if (verseEl) {
			const verseNum = config.showVerseNumbers
				? `<span class="v-num">${v}</span>`
				: '';
			// Preserve HTML content including footnotes
			const verseContent = processVerseContent(verseEl as HTMLElement, footnotes);
			verses.push(`${verseNum}<span class="v">${verseContent}</span>`);
		}
	}

	if (verses.length === 0) {
		throw new Error('Verse not found');
	}

	return { content: verses.join(' '), footnotes };
}

/**
 * Build HTML for footnotes section
 * @param footnotes - Array of extracted footnotes
 * @returns HTML string for footnotes section, or empty string if none
 */
export function buildFootnotesHtml(footnotes: ExtractedFootnote[]): string {
	if (footnotes.length === 0) {
		return '';
	}

	const footnoteItems = footnotes.map(fn =>
		`<div class="verse-popup-footnote"><span class="fn-key">${fn.key}</span><span class="fn-text">${fn.text}</span></div>`
	).join('');

	return `<div class="verse-popup-footnotes">${footnoteItems}</div>`;
}
