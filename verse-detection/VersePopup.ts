/**
 * VersePopup Module
 *
 * Handles the display of verse content in hover popups.
 * Integrates with Browser Bible 4's text loading system to fetch verse content.
 */

import { config as defaultConfig, mergeConfig, VerseDetectionConfig, PartialVerseDetectionConfig } from './config.js';
import type { CanonicalBookName } from './bookNames.js';
import { BOOK_CODES, type BookCode } from './BookCodes.js';
import {
	normalizeLangCode as normalizeLangCodeUtil,
	getLanguageName as getLanguageNameUtil,
	buildTextIdsByLanguage as buildTextIdsByLanguageUtil
} from './LanguageCodeMapper.js';
import {
	SOCIAL_ICONS,
	buildSocialShareHtml as buildSocialShareHtmlUtil,
	handleSocialShare as handleSocialShareUtil
} from './SocialShareHandler.js';
import {
	extractVerses as extractVersesUtil,
	buildFootnotesHtml as buildFootnotesHtmlUtil,
	type ExtractedFootnote
} from './VerseExtractor.js';
import { getTextId as getTextIdUtil } from './VerseUrlBuilder.js';

/** Embedded inscript.org logo SVG */
const INSCRIPT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
<path fill="#D1EAF1" d="M44 23Q33 8 9 0q23 34-8 64 30-10 43-40"/>
<path fill="#A5CBE2" d="M61 34Q51 14 34 3q0 44-33 61 39-3 60-30"/>
<path fill="#3F87C1" d="M69 40q-4-14-15-29-8 47-53 53 52-2 68-24"/>
<path fill="#2468B9" d="M72 59q0-6-2-10Q48 64 0 64q30 1 72-5"/>
<rect fill="#666" width="70" height="4" x="2" y="67" rx="2"/>
</svg>`;

// SOCIAL_ICONS imported from SocialShareHandler.ts

// BookCode type re-exported from BookCodes.ts for backward compatibility
export type { BookCode } from './BookCodes.js';

/** Parsed verse reference */
export interface ParsedReference {
	book: string;
	bookCode: BookCode;
	chapter: number;
	startVerse: number | null;
	endVerse: number | null;
	sectionId: string;
	verseId: string | null;
}

/** Text info from texts index */
export interface TextInfo {
	id: string;
	name?: string;
	lang?: string;
	langName?: string;
	langNameEnglish?: string;
	type?: string;
	hasText?: boolean;
}

/** App interface for integration */
export interface BrowserBibleApp {
	currentTextId?: string;
	config?: {
		defaultTextId?: string;
		baseContentUrl?: string;
	};
	navigateToRef?: (sectionId: string, verseId: string | null) => void;
	trigger?: (event: string, data: { sectionId: string; verseId: string | null }) => void;
	getActiveWindow?: () => { textId?: string } | null;
	on?: (event: string, callback: (lang: string) => void) => void;
}

/** Text loader interface */
export interface TextLoader {
	getText: (
		textId: string,
		onSuccess: (textInfo: TextInfo) => void,
		onError?: (error: Error) => void
	) => void;
	loadSection: (
		textInfo: TextInfo,
		sectionId: string,
		onSuccess: (html: string) => void,
		onError?: (error: Error) => void
	) => void;
}

/**
 * Create the popup element and inject styles
 */
function createPopupElement(config: VerseDetectionConfig): HTMLDivElement {
	// Inject styles if not already present
	if (!document.getElementById('verse-popup-styles')) {
		const styles = document.createElement('style');
		styles.id = 'verse-popup-styles';
		styles.textContent = `
			.verse-popup {
				position: absolute;
				z-index: 10000;
				background: var(--popup-bg, #fff);
				border: 1px solid var(--popup-border, #ccc);
				border-radius: 6px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				padding: 12px 16px;
				width: auto;
				min-width: 200px;
				max-width: ${config.popup.maxWidth}px;
				font-size: 14px;
				line-height: 1.5;
				opacity: 0;
				transform: translateY(8px);
				transition: opacity 0.2s, transform 0.2s;
				pointer-events: none;
			}

			.verse-popup.visible {
				opacity: 1;
				transform: translateY(0);
				pointer-events: auto;
			}

			.verse-popup-header {
				font-weight: 600;
				margin-bottom: 8px;
				padding-bottom: 6px;
				border-bottom: 1px solid var(--popup-border, #eee);
				color: var(--popup-header-color, #333);
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
			}

			.verse-popup-header-text {
				flex: 1;
			}

			.verse-popup-logo {
				flex-shrink: 0;
				width: 20px;
				height: 20px;
				opacity: 0.7;
				transition: opacity 0.2s ease;
			}

			.verse-popup-logo:hover {
				opacity: 1;
			}

			.verse-popup-logo svg {
				width: 100%;
				height: 100%;
				display: block;
			}

			.verse-popup-content {
				color: var(--popup-text-color, #444);
				max-height: ${config.popup.maxHeight}px;
				overflow-y: auto;
			}

			/* Scrollable content indicator */
			.verse-popup-content.scrollable {
				padding-right: 8px;
			}

			/* Custom scrollbar for popup content */
			.verse-popup-content::-webkit-scrollbar {
				width: 6px;
			}

			.verse-popup-content::-webkit-scrollbar-track {
				background: var(--popup-scrollbar-track, #f1f1f1);
				border-radius: 3px;
			}

			.verse-popup-content::-webkit-scrollbar-thumb {
				background: var(--popup-scrollbar-thumb, #c1c1c1);
				border-radius: 3px;
			}

			.verse-popup-content::-webkit-scrollbar-thumb:hover {
				background: var(--popup-scrollbar-thumb-hover, #a8a8a8);
			}

			.verse-popup-content .v-num {
				font-weight: 600;
				color: var(--popup-verse-num-color, #666);
				font-size: 0.85em;
				margin-right: 4px;
				vertical-align: super;
			}

			.verse-popup-content .v {
				display: inline;
			}

			/* Footnote marker in verse text */
			.verse-popup-content .note-marker {
				display: inline-block;
				font-size: 0.75em;
				color: var(--popup-footnote-key-color, #4a90d9);
				vertical-align: super;
				padding: 0 1px;
				font-weight: 600;
			}

			/* Footnotes section below verses */
			.verse-popup-footnotes {
				margin-top: 8px;
				padding-top: 8px;
				border-top: 1px solid var(--popup-border, #ddd);
				font-size: 0.9em;
				color: var(--popup-footnote-text-color, #666);
			}

			.verse-popup-footnote {
				margin-bottom: 6px;
				line-height: 1.4;
			}

			.verse-popup-footnote:last-child {
				margin-bottom: 0;
			}

			.verse-popup-footnote .fn-key {
				font-weight: 600;
				color: var(--popup-footnote-key-color, #4a90d9);
				margin-right: 4px;
			}

			.verse-popup-footnote .fn-text {
				color: var(--popup-footnote-text-color, #555);
			}

			/* Cross-reference links within footnotes */
			.verse-popup-footnotes .bibleref,
			.verse-popup-footnotes .xt {
				color: var(--popup-xref-color, #4a90d9);
				text-decoration: underline;
				text-decoration-style: dotted;
				cursor: pointer;
			}

			.verse-popup-footnotes .bibleref:hover,
			.verse-popup-footnotes .xt:hover {
				text-decoration-style: solid;
			}

			/* Social share footer */
			.verse-popup-social {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 12px;
				margin-top: 10px;
				padding-top: 10px;
				border-top: 1px solid var(--popup-border, #eee);
			}

			.verse-popup-social-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 32px;
				height: 32px;
				border: none;
				border-radius: 50%;
				background: var(--popup-social-btn-bg, #f0f0f0);
				color: var(--popup-social-btn-color, #555);
				cursor: pointer;
				transition: all 0.2s ease;
				padding: 0;
			}

			.verse-popup-social-btn:hover {
				background: var(--popup-social-btn-hover-bg, #e0e0e0);
				color: var(--popup-social-btn-hover-color, #333);
				transform: scale(1.1);
			}

			.verse-popup-social-btn:active {
				transform: scale(0.95);
			}

			.verse-popup-social-btn svg {
				width: 16px;
				height: 16px;
			}

			.verse-popup-social-btn.facebook:hover {
				background: #1877f2;
				color: #fff;
			}

			.verse-popup-social-btn.x:hover {
				background: #000;
				color: #fff;
			}

			.verse-popup-social-btn.bluesky:hover {
				background: #0085ff;
				color: #fff;
			}

			.verse-popup-social-btn.copy:hover {
				background: #4a90d9;
				color: #fff;
			}

			.verse-popup-social-btn.copied {
				background: #4caf50 !important;
				color: #fff !important;
			}

			.verse-popup-loading {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 20px;
				color: var(--popup-loading-color, #888);
			}

			.verse-popup-loading::after {
				content: '';
				width: 16px;
				height: 16px;
				margin-left: 8px;
				border: 2px solid currentColor;
				border-top-color: transparent;
				border-radius: 50%;
				animation: verse-popup-spin 0.8s linear infinite;
			}

			@keyframes verse-popup-spin {
				to { transform: rotate(360deg); }
			}

			.verse-popup-error {
				color: var(--popup-error-color, #d32f2f);
				font-style: italic;
			}

			.verse-link {
				color: var(--verse-link-color, inherit);
				text-decoration: underline;
				text-decoration-style: dotted;
				text-underline-offset: 2px;
				cursor: pointer;
				transition: all 0.15s ease;
				border-radius: 2px;
				padding: 0 1px;
				margin: 0 -1px;
			}

			.verse-link:hover {
				text-decoration-style: solid;
				background-color: var(--verse-link-hover-bg, rgba(74, 144, 217, 0.1));
				color: var(--verse-link-hover-color, #4a90d9);
			}

			.verse-link:active {
				background-color: var(--verse-link-active-bg, rgba(74, 144, 217, 0.2));
				transform: scale(0.98);
			}

			/* Touch device enhancements */
			@media (hover: none) {
				.verse-link {
					padding: 2px 4px;
					margin: 0 -4px;
				}
			}

			.verse-detected {
				background-color: var(--verse-highlight-bg, rgba(255, 235, 59, 0.2));
				border-radius: 2px;
				padding: 0 2px;
			}

			/* Dark mode support */
			@media (prefers-color-scheme: dark) {
				.verse-popup {
					--popup-bg: #2d2d2d;
					--popup-border: #444;
					--popup-header-color: #e0e0e0;
					--popup-text-color: #ccc;
					--popup-verse-num-color: #999;
					--popup-footnote-key-color: #6ab0f3;
					--popup-footnote-text-color: #aaa;
					--popup-xref-color: #6ab0f3;
					--popup-social-btn-bg: #3d3d3d;
					--popup-social-btn-color: #aaa;
					--popup-social-btn-hover-bg: #4d4d4d;
					--popup-social-btn-hover-color: #fff;
				}
			}
		`;
		document.head.appendChild(styles);
	}

	// Create popup element with ARIA attributes for accessibility
	const popup = document.createElement('div');
	popup.className = `verse-popup ${config.popup.cssClass}`;
	popup.setAttribute('role', 'dialog');
	popup.setAttribute('aria-modal', 'false');
	popup.setAttribute('aria-label', 'Verse preview');
	popup.setAttribute('aria-live', 'polite');
	popup.id = 'verse-popup-' + Math.random().toString(36).substr(2, 9);
	popup.style.display = 'none';
	document.body.appendChild(popup);

	return popup;
}

/**
 * VersePopup class - manages popup display and verse fetching
 */
export class VersePopup {
	private config: VerseDetectionConfig;
	private popup: HTMLDivElement | null = null;
	private currentTarget: HTMLElement | null = null;
	private showTimeout: ReturnType<typeof setTimeout> | null = null;
	private hideTimeout: ReturnType<typeof setTimeout> | null = null;
	private cache: Map<string, { content: string; footnotes: Array<{ key: string; text: string }> }> = new Map();
	private textLoader: TextLoader | null = null;
	private currentTextInfo: TextInfo | null = null;
	private textsIndexLoaded: boolean = false;
	private textsIndexData: TextInfo[] | null = null;
	private app: BrowserBibleApp | null = null;
	private touchStartTime: number = 0;
	private touchStartTarget: HTMLElement | null = null;
	private hasTouch: boolean = typeof document !== 'undefined' && 'ontouchend' in document;

	constructor(options: PartialVerseDetectionConfig = {}) {
		this.config = mergeConfig(options);

		// Bind methods
		this.handleMouseEnter = this.handleMouseEnter.bind(this);
		this.handleMouseLeave = this.handleMouseLeave.bind(this);
		this.handleClick = this.handleClick.bind(this);
		this.handleTouchStart = this.handleTouchStart.bind(this);
		this.handleTouchEnd = this.handleTouchEnd.bind(this);
		this.handleKeyDown = this.handleKeyDown.bind(this);
	}

	/**
	 * Initialize the popup system
	 * @param app - Browser Bible 4 app instance for integration
	 */
	async init(app?: BrowserBibleApp): Promise<void> {
		if (typeof document === 'undefined') return;

		this.popup = createPopupElement(this.config);
		this.app = app || null;

		// Try to get text loader from app
		if (app && this.config.appIntegration.useAppTextLoader) {
			try {
				// Import TextLoader dynamically - use variable to prevent static analysis
				const textLoaderPath = '../js/texts/TextLoader.js';
				const textLoaderModule = await import(/* @vite-ignore */ textLoaderPath);
				this.textLoader = textLoaderModule as TextLoader;
			} catch (e) {
				console.warn('VersePopup: Could not load TextLoader (standalone mode)', e);
			}
		}

		// Load texts index and build dynamic text ID mapping
		if (this.config.contentSource?.dynamicTextSelection) {
			await this.loadTextsIndex();
		}

		// Add popup mouse events to keep it visible when hovered
		this.popup.addEventListener('mouseenter', () => {
			this.clearHideTimeout();
		});

		this.popup.addEventListener('mouseleave', () => {
			this.scheduleHide();
		});

		// Handle cross-reference clicks within popup footnotes
		this.popup.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;

			// Handle cross-reference clicks in footnotes
			if (target.classList.contains('bibleref') || target.classList.contains('xt')) {
				e.preventDefault();
				e.stopPropagation();
				const refText = target.getAttribute('data-id') || target.getAttribute('title') || target.textContent;
				if (refText && this.app) {
					this.navigateToVerse(refText);
				}
			}
		});

		// Handle keyboard events for accessibility
		document.addEventListener('keydown', this.handleKeyDown);
	}

	/**
	 * Load the texts index JSON and build dynamic textIdsByLanguage mapping
	 * This fetches the available Bible versions and maps them to language codes
	 */
	private async loadTextsIndex(): Promise<void> {
		const contentConfig = this.config.contentSource;
		const textsIndexUrl = contentConfig?.textsIndexUrl;

		if (!textsIndexUrl) {
			console.warn('VersePopup: No textsIndexUrl configured, using preferredTextIdsByLanguage only');
			this.config.contentSource.textIdsByLanguage = { ...contentConfig.preferredTextIdsByLanguage as Record<string, string> };
			return;
		}

		try {
			const response = await fetch(textsIndexUrl);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = await response.json();
			this.textsIndexData = (data.textInfoData || data) as TextInfo[];
			this.textsIndexLoaded = true;

			// Build the dynamic mapping
			this.buildTextIdsByLanguage();

			console.log('VersePopup: Loaded texts index, built language mappings:', this.config.contentSource.textIdsByLanguage);
		} catch (error) {
			console.error('VersePopup: Error loading texts index:', error);
			// Fall back to preferred mappings only
			this.config.contentSource.textIdsByLanguage = { ...contentConfig.preferredTextIdsByLanguage as Record<string, string> };
		}
	}

	/**
	 * Build textIdsByLanguage mapping from the texts index data
	 * Respects preferredTextIdsByLanguage for priority selection
	 */
	private buildTextIdsByLanguage(): void {
		const contentConfig = this.config.contentSource;
		const preferred = contentConfig.preferredTextIdsByLanguage || {};
		const mapping = buildTextIdsByLanguageUtil(this.textsIndexData, preferred);
		this.config.contentSource.textIdsByLanguage = mapping;
	}

	/**
	 * Get display name for a language code
	 * @param langCode - 2-letter language code
	 * @returns Display name
	 */
	private getLanguageName(langCode: string | null | undefined): string {
		return getLanguageNameUtil(langCode);
	}

	/**
	 * Normalize a 3-letter ISO 639-3 language code to 2-letter ISO 639-1
	 * Also handles language names as fallback
	 * @param lang3 - 3-letter language code (e.g., 'eng', 'spa')
	 * @param langName - Language name as fallback
	 * @returns 2-letter language code (e.g., 'en', 'es')
	 */
	private normalizeLangCode(lang3: string | undefined, langName: string | undefined): string | null {
		return normalizeLangCodeUtil(lang3, langName);
	}

	/**
	 * Attach event listeners to verse links within a container
	 * @param container - Container element to scan
	 */
	attach(container: HTMLElement | null): void {
		if (!container) return;

		const links = container.querySelectorAll<HTMLElement>('.verse-link[data-verse-ref]');
		links.forEach(link => {
			// Add ARIA attributes for accessibility
			const ref = link.dataset.verseRef || '';
			link.setAttribute('role', 'button');
			link.setAttribute('tabindex', '0');
			link.setAttribute('aria-haspopup', 'dialog');
			link.setAttribute('aria-expanded', 'false');
			link.setAttribute('aria-label', `View ${ref}`);
			if (this.popup) {
				link.setAttribute('aria-controls', this.popup.id);
			}

			// Mouse events for desktop
			if (!this.hasTouch) {
				link.addEventListener('mouseenter', this.handleMouseEnter);
				link.addEventListener('mouseleave', this.handleMouseLeave);
			}

			// Touch events for mobile/tablet
			if (this.hasTouch) {
				link.addEventListener('touchstart', this.handleTouchStart, { passive: true });
				link.addEventListener('touchend', this.handleTouchEnd);
			}

			// Click works on both
			link.addEventListener('click', this.handleClick);
		});
	}

	/**
	 * Detach event listeners from verse links
	 * @param container - Container element
	 */
	detach(container: HTMLElement | null): void {
		if (!container) return;

		const links = container.querySelectorAll<HTMLElement>('.verse-link[data-verse-ref]');
		links.forEach(link => {
			link.removeEventListener('mouseenter', this.handleMouseEnter);
			link.removeEventListener('mouseleave', this.handleMouseLeave);
			link.removeEventListener('touchstart', this.handleTouchStart);
			link.removeEventListener('touchend', this.handleTouchEnd);
			link.removeEventListener('click', this.handleClick);
		});
	}

	/**
	 * Handle mouse enter on verse link
	 */
	private handleMouseEnter(event: Event): void {
		if (this.config.displayMode === 'link') return;

		const target = event.target as HTMLElement;
		this.currentTarget = target;
		this.clearHideTimeout();

		this.showTimeout = setTimeout(() => {
			this.show(target);
		}, this.config.popup.showDelay);
	}

	/**
	 * Handle mouse leave on verse link
	 */
	private handleMouseLeave(): void {
		if (this.config.displayMode === 'link') return;

		this.clearShowTimeout();
		this.scheduleHide();
	}

	/**
	 * Handle touch start on verse link (for mobile)
	 */
	private handleTouchStart(event: TouchEvent): void {
		this.touchStartTime = Date.now();
		this.touchStartTarget = event.target as HTMLElement;
	}

	/**
	 * Handle touch end on verse link (for mobile)
	 * Short tap = navigate, long press = show popup
	 */
	private handleTouchEnd(event: TouchEvent): void {
		const touchDuration = Date.now() - this.touchStartTime;
		const target = this.touchStartTarget;

		if (!target) return;

		// Long press (> 300ms) shows popup without navigation
		if (touchDuration > 300 && this.config.displayMode !== 'link') {
			event.preventDefault();
			this.show(target);
			return;
		}

		// Short tap - if popup is visible for this target, hide it and navigate
		// If popup is not visible, show popup first (for 'both' mode)
		if (this.config.displayMode === 'both') {
			if (this.popup?.classList.contains('visible') && this.currentTarget === target) {
				// Popup is already showing - let click handler navigate
				this.hide();
			} else {
				// Show popup on first tap
				event.preventDefault();
				this.show(target);
			}
		}
		// For 'popup' mode, short tap also shows popup
		else if (this.config.displayMode === 'popup') {
			event.preventDefault();
			if (this.popup?.classList.contains('visible') && this.currentTarget === target) {
				this.hide();
			} else {
				this.show(target);
			}
		}
		// For 'link' mode, let click handler handle navigation
	}

	/**
	 * Handle click on verse link
	 */
	private handleClick(event: Event): void {
		const target = event.target as HTMLElement;
		const ref = target.dataset.verseRef;
		if (!ref) return;

		// In popup-only mode, never navigate
		if (this.config.displayMode === 'popup') {
			event.preventDefault();
			// On non-touch devices, popup is shown via hover
			// On touch devices, it's handled by touchEnd
			if (!this.hasTouch) {
				this.show(target);
			}
			return;
		}

		// In 'both' mode on touch devices, first tap shows popup, second tap navigates
		// This is handled by touchEnd, so we need to check if we should navigate
		if (this.config.displayMode === 'both' && this.hasTouch) {
			// If popup is visible and showing this reference, navigate
			if (this.popup?.classList.contains('visible') && this.currentTarget === target) {
				this.hide();
				// Continue to navigation below
			} else {
				// Otherwise, touchEnd already handled showing popup
				event.preventDefault();
				return;
			}
		}

		// Navigate (for 'link' and 'both' modes)
		if (this.app && this.config.appIntegration.useAppNavigation) {
			event.preventDefault();
			this.navigateToVerse(ref);
		}
		// Otherwise let the link handle navigation normally (default anchor behavior)
	}

	/**
	 * Handle keyboard events for accessibility
	 * Escape closes popup, Enter/Space on verse link toggles popup
	 */
	private handleKeyDown(event: KeyboardEvent): void {
		// Escape key closes the popup
		if (event.key === 'Escape' && this.popup?.classList.contains('visible')) {
			this.hide();
			// Return focus to the triggering element
			if (this.currentTarget) {
				this.currentTarget.focus();
			}
			return;
		}

		// Enter or Space on a verse link toggles popup
		if ((event.key === 'Enter' || event.key === ' ') && this.config.displayMode !== 'link') {
			const target = event.target as HTMLElement;
			if (target.classList.contains('verse-link') && target.dataset.verseRef) {
				event.preventDefault();
				if (this.popup?.classList.contains('visible') && this.currentTarget === target) {
					this.hide();
				} else {
					this.show(target);
				}
			}
		}
	}

	/**
	 * Navigate to a verse using the app's navigation system
	 */
	private navigateToVerse(reference: string): void {
		if (!this.app) return;

		// Parse the reference to get book code and chapter
		const parsed = this.parseReference(reference);
		if (!parsed) return;

		// Navigate using app
		if (typeof this.app.navigateToRef === 'function') {
			this.app.navigateToRef(parsed.sectionId, parsed.verseId);
		} else if (typeof this.app.trigger === 'function') {
			this.app.trigger('navigate', {
				sectionId: parsed.sectionId,
				verseId: parsed.verseId
			});
		}
	}

	/**
	 * Show the popup for a verse link
	 */
	async show(target: HTMLElement): Promise<void> {
		const ref = target.dataset.verseRef;
		if (!ref || !this.popup) return;

		// Get detected language from data attribute
		const detectedLang = target.dataset.detectedLang || this.config.language?.primary || 'en';

		// Check if text is available for this language before showing popup
		const textId = this.getTextId(detectedLang);
		if (!textId) {
			// No text available for this language - don't show popup
			return;
		}

		// Update ARIA expanded state on previous target
		if (this.currentTarget && this.currentTarget !== target) {
			this.currentTarget.setAttribute('aria-expanded', 'false');
		}
		this.currentTarget = target;

		// Position the popup initially
		this.positionPopup(target);

		// Show loading state
		if (this.config.popup.showLoadingIndicator) {
			this.popup.innerHTML = '<div class="verse-popup-loading" role="status" aria-live="polite">Loading</div>';
		}

		// Update ARIA attributes
		target.setAttribute('aria-expanded', 'true');
		this.popup.setAttribute('aria-label', `Verse preview: ${ref}`);

		this.popup.style.display = 'block';
		// Force reflow for transition
		this.popup.offsetHeight;
		this.popup.classList.add('visible');

		// Fetch and display verse content
		try {
			const content = await this.fetchVerseContent(ref, detectedLang);
			this.displayContent(ref, content);
			// Reposition after content loads to account for actual size
			requestAnimationFrame(() => {
				this.positionPopup(target);
			});
		} catch (error) {
			this.displayError((error as Error).message);
		}
	}

	/**
	 * Hide the popup
	 */
	hide(): void {
		if (!this.popup) return;

		// Update ARIA expanded state
		if (this.currentTarget) {
			this.currentTarget.setAttribute('aria-expanded', 'false');
		}

		this.popup.classList.remove('visible');
		setTimeout(() => {
			if (this.popup && !this.popup.classList.contains('visible')) {
				this.popup.style.display = 'none';
			}
		}, 200);
	}

	/**
	 * Position the popup relative to target element
	 */
	private positionPopup(target: HTMLElement): void {
		if (!this.popup) return;

		const rect = target.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		// Get actual popup dimensions (may be smaller than max)
		const popupHeight = Math.min(this.popup.offsetHeight, this.config.popup.maxHeight + 80); // +80 for header/padding
		const popupWidth = Math.min(this.popup.offsetWidth, this.config.popup.maxWidth);

		let top: number, left: number;

		// Horizontal positioning - center on target, keep within viewport
		left = rect.left + (rect.width / 2) - (popupWidth / 2);
		left = Math.max(10, Math.min(left, viewportWidth - popupWidth - 10));

		// Vertical positioning
		const spaceAbove = rect.top;
		const spaceBelow = viewportHeight - rect.bottom;
		const preferAbove = this.config.popup.position === 'above' ||
			(this.config.popup.position === 'auto' && spaceBelow < popupHeight + 20 && spaceAbove > spaceBelow);

		if (preferAbove) {
			top = rect.top + window.scrollY - popupHeight - 10;
			// Make sure we don't go above the viewport
			if (top < window.scrollY + 10) {
				top = window.scrollY + 10;
			}
		} else {
			top = rect.bottom + window.scrollY + 10;
		}

		this.popup.style.left = `${left}px`;
		this.popup.style.top = `${top}px`;
	}

	/**
	 * Parse a verse reference string
	 */
	parseReference(reference: string): ParsedReference | null {
		// Match pattern like "John 3:16" or "1 John 2:3-4"
		const match = reference.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
		if (!match) return null;

		const [, bookName, chapter, startVerse, endVerse] = match;
		const bookCode = BOOK_CODES[bookName as CanonicalBookName];

		if (!bookCode) return null;

		return {
			book: bookName,
			bookCode,
			chapter: parseInt(chapter, 10),
			startVerse: startVerse ? parseInt(startVerse, 10) : null,
			endVerse: endVerse ? parseInt(endVerse, 10) : (startVerse ? parseInt(startVerse, 10) : null),
			sectionId: `${bookCode}${chapter}`,
			verseId: startVerse ? `${bookCode}${chapter}_${startVerse}` : null
		};
	}

	/**
	 * Fetch verse content from configured source
	 * @param reference - Verse reference string
	 * @param detectedLang - Detected language of the verse reference
	 */
	async fetchVerseContent(reference: string, detectedLang: string | null = null): Promise<string> {
		// Include language in cache key for language-specific content
		const cacheKey = detectedLang ? `${reference}:${detectedLang}` : reference;

		// Check cache first
		if (this.config.popup.cacheContent && this.cache.has(cacheKey)) {
			const cached = this.cache.get(cacheKey)!;
			// Restore footnotes from cache
			this.collectedFootnotes = cached.footnotes;
			return cached.content;
		}

		const parsed = this.parseReference(reference);
		if (!parsed) {
			throw new Error('Invalid verse reference');
		}

		let content: string;
		const sourceType = this.config.contentSource?.type || 'remote';

		// Fetch based on content source type
		switch (sourceType) {
			case 'app':
				if (this.textLoader && this.app) {
					content = await this.fetchFromTextLoader(parsed, detectedLang);
				} else {
					throw new Error('App TextLoader not available');
				}
				break;
			case 'local':
			case 'remote':
			default:
				content = await this.fetchChapterAndExtractVerses(parsed, detectedLang);
				break;
		}

		// Cache the result along with footnotes
		if (this.config.popup.cacheContent) {
			this.cache.set(cacheKey, {
				content,
				footnotes: [...this.collectedFootnotes]
			});
		}

		return content;
	}

	/**
	 * Get the text ID based on configuration and language
	 * Uses dynamically loaded textIdsByLanguage mapping if available
	 * @param detectedLang - Detected language to use for text selection
	 * @returns Text ID or null if none available for the language
	 */
	getTextId(detectedLang: string | null = null): string | null {
		return getTextIdUtil(detectedLang, this.config);
	}

	/**
	 * Fetch chapter HTML and extract specific verses
	 * @param parsed - Parsed verse reference
	 * @param detectedLang - Detected language for text selection
	 */
	private async fetchChapterAndExtractVerses(parsed: ParsedReference, detectedLang: string | null = null): Promise<string> {
		const contentConfig = this.config.contentSource;
		const baseUrl = contentConfig?.baseUrl || 'https://inscript.bible.cloud/content/texts';
		const textId = this.getTextId(detectedLang);

		// If no text available for this language, throw a specific error
		if (!textId) {
			const langName = this.getLanguageName(detectedLang);
			throw new Error(`No Bible text available for ${langName}`);
		}

		const pathTemplate = contentConfig?.pathTemplate || '{baseUrl}/{textId}/{sectionId}.html';

		// Build URL for chapter file
		const url = pathTemplate
			.replace('{baseUrl}', baseUrl)
			.replace('{textId}', textId)
			.replace('{sectionId}', parsed.sectionId);

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to load chapter: ${response.status}`);
			}

			const html = await response.text();
			return this.extractVerses(html, parsed);
		} catch (error) {
			console.error('Chapter fetch error:', error);
			throw new Error('Chapter not available');
		}
	}

	/**
	 * Fetch verse content using the app's TextLoader
	 * @param parsed - Parsed verse reference
	 * @param detectedLang - Detected language for text selection
	 */
	private fetchFromTextLoader(parsed: ParsedReference, detectedLang: string | null = null): Promise<string> {
		return new Promise((resolve, reject) => {
			// Get text ID - prefer detected language version, fall back to current
			const textId = this.getTextId(detectedLang);
			if (!textId) {
				const langName = this.getLanguageName(detectedLang);
				reject(new Error(`No Bible text available for ${langName}`));
				return;
			}

			if (!this.textLoader) {
				reject(new Error('TextLoader not available'));
				return;
			}

			this.textLoader.getText(textId, (textInfo: TextInfo) => {
				this.textLoader!.loadSection(textInfo, parsed.sectionId, (html: string) => {
					const verses = this.extractVerses(html, parsed);
					resolve(verses);
				}, (error: Error) => {
					reject(new Error('Failed to load chapter'));
				});
			}, (error: Error) => {
				reject(new Error('Failed to load text info'));
			});
		});
	}

	/**
	 * Fetch verse content directly from files (fallback)
	 */
	private async fetchFromFiles(parsed: ParsedReference): Promise<string> {
		const textId = this.config.defaultTextId || 'webbe';
		const baseUrl = this.app?.config?.baseContentUrl || '';
		const url = `${baseUrl}content/texts/${textId}/${parsed.sectionId}.html`;

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error('Chapter not found');
		}

		const html = await response.text();
		return this.extractVerses(html, parsed);
	}

	/**
	 * Extract specific verses from chapter HTML
	 * Extracts footnotes and places markers inline, footnotes collected for display below
	 */
	private extractVerses(html: string, parsed: ParsedReference): string {
		const result = extractVersesUtil(html, parsed, {
			showVerseNumbers: this.config.popup.showVerseNumbers
		});
		this.collectedFootnotes = result.footnotes;
		return result.content;
	}

	/** Extracted footnote data */
	private collectedFootnotes: ExtractedFootnote[] = [];

	/**
	 * Clear collected footnotes (call before processing new verses)
	 */
	private clearFootnotes(): void {
		this.collectedFootnotes = [];
	}

	/**
	 * Build HTML for collected footnotes section
	 * @returns HTML string for footnotes section, or empty string if none
	 */
	private buildFootnotesHtml(): string {
		return buildFootnotesHtmlUtil(this.collectedFootnotes);
	}

	/**
	 * Get the currently active text ID from the app
	 */
	private getCurrentTextId(): string | null {
		if (!this.app) return null;

		// Try various ways to get the current text
		if (this.app.currentTextId) return this.app.currentTextId;
		if (this.app.config?.defaultTextId) return this.app.config.defaultTextId;

		// Try to get from active window
		const activeWindow = this.app.getActiveWindow?.();
		if (activeWindow?.textId) return activeWindow.textId;

		return null;
	}

	/**
	 * Build HTML for social share buttons
	 * @param reference - Verse reference for sharing
	 * @param content - Plain text content for sharing
	 * @returns HTML string for social share section
	 */
	private buildSocialShareHtml(reference: string, content: string): string {
		return buildSocialShareHtmlUtil({
			showSocialShare: this.config.popup.showSocialShare,
			socialSharePlatforms: this.config.popup.socialSharePlatforms,
			appBaseUrl: this.config.appBaseUrl
		});
	}

	/**
	 * Handle social share button click
	 */
	private handleSocialShare(platform: string, reference: string, content: string): void {
		const popup = this.popup;
		handleSocialShareUtil(
			platform,
			reference,
			content,
			this.config.appBaseUrl,
			(ref) => this.parseReference(ref),
			popup ? (selector, className, duration) => {
				const btn = popup.querySelector(selector);
				if (btn) {
					btn.classList.add(className);
					setTimeout(() => btn.classList.remove(className), duration);
				}
			} : undefined
		);
	}

	/** Current reference for social sharing */
	private currentReference: string = '';
	/** Current content for social sharing */
	private currentContent: string = '';

	/**
	 * Display verse content in the popup
	 */
	private displayContent(reference: string, content: string): void {
		if (!this.popup) return;

		// Store for social sharing
		this.currentReference = reference;
		this.currentContent = content;

		let html = '';

		if (this.config.popup.showHeader) {
			const logoHtml = this.config.popup.showLogo
				? `<a href="${this.config.popup.logoUrl}" target="_blank" rel="noopener noreferrer" class="verse-popup-logo" title="Powered by inscript.org">${INSCRIPT_LOGO_SVG}</a>`
				: '';
			html += `<div class="verse-popup-header"><span class="verse-popup-header-text">${reference}</span>${logoHtml}</div>`;
		}

		// Add verse content
		html += `<div class="verse-popup-content">${content}`;

		// Add footnotes section if any were collected
		const footnotesHtml = this.buildFootnotesHtml();
		if (footnotesHtml) {
			html += footnotesHtml;
		}

		html += `</div>`;

		// Add social share footer
		const socialHtml = this.buildSocialShareHtml(reference, content);
		if (socialHtml) {
			html += socialHtml;
		}

		this.popup.innerHTML = html;

		// Attach social share click handlers
		if (this.config.popup.showSocialShare) {
			this.popup.querySelectorAll('.verse-popup-social-btn').forEach(btn => {
				btn.addEventListener('click', (e) => {
					e.stopPropagation();
					const platform = (btn as HTMLElement).dataset.platform;
					if (platform) {
						this.handleSocialShare(platform, this.currentReference, this.currentContent);
					}
				});
			});
		}

		// Check if content needs scrolling and add appropriate class
		const contentEl = this.popup.querySelector<HTMLElement>('.verse-popup-content');
		if (contentEl) {
			// Use requestAnimationFrame to ensure the DOM has updated
			requestAnimationFrame(() => {
				if (contentEl.scrollHeight > contentEl.clientHeight) {
					contentEl.classList.add('scrollable');
				} else {
					contentEl.classList.remove('scrollable');
				}
			});
		}
	}

	/**
	 * Display an error message in the popup
	 */
	private displayError(message: string): void {
		if (!this.popup) return;
		this.popup.innerHTML = `<div class="verse-popup-error">${message}</div>`;
	}

	/**
	 * Clear show timeout
	 */
	private clearShowTimeout(): void {
		if (this.showTimeout) {
			clearTimeout(this.showTimeout);
			this.showTimeout = null;
		}
	}

	/**
	 * Clear hide timeout
	 */
	private clearHideTimeout(): void {
		if (this.hideTimeout) {
			clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}

	/**
	 * Schedule hiding the popup
	 */
	private scheduleHide(): void {
		this.hideTimeout = setTimeout(() => {
			this.hide();
		}, this.config.popup.hideDelay);
	}

	/**
	 * Get all available texts for a specific language
	 * @param langCode - 2-letter language code (e.g., 'en', 'es')
	 * @returns Array of text info objects for the language
	 */
	getTextsForLanguage(langCode: string): TextInfo[] {
		if (!this.textsIndexData || !Array.isArray(this.textsIndexData)) {
			return [];
		}

		return this.textsIndexData.filter(textInfo => {
			if (textInfo.type && textInfo.type !== 'bible') return false;
			if (textInfo.hasText === false) return false;

			const textLangCode = this.normalizeLangCode(
				textInfo.lang,
				textInfo.langNameEnglish || textInfo.langName
			);
			return textLangCode === langCode;
		});
	}

	/**
	 * Get all available languages with their text counts
	 * @returns Map of language codes to text counts
	 */
	getAvailableLanguages(): Record<string, number> {
		if (!this.textsIndexData || !Array.isArray(this.textsIndexData)) {
			return {};
		}

		const languages: Record<string, number> = {};

		for (const textInfo of this.textsIndexData) {
			if (textInfo.type && textInfo.type !== 'bible') continue;
			if (textInfo.hasText === false) continue;

			const langCode = this.normalizeLangCode(
				textInfo.lang,
				textInfo.langNameEnglish || textInfo.langName
			);

			if (langCode) {
				languages[langCode] = (languages[langCode] || 0) + 1;
			}
		}

		return languages;
	}

	/**
	 * Set preferred text ID for a language
	 * @param langCode - 2-letter language code
	 * @param textId - Text ID or array of text IDs in priority order
	 */
	setPreferredText(langCode: string, textId: string | string[]): void {
		const contentConfig = this.config.contentSource;
		if (!contentConfig.preferredTextIdsByLanguage) {
			contentConfig.preferredTextIdsByLanguage = {};
		}
		contentConfig.preferredTextIdsByLanguage[langCode] = textId;

		// Rebuild the mapping if texts index is loaded
		if (this.textsIndexLoaded) {
			this.buildTextIdsByLanguage();
		}
	}

	/**
	 * Get the current text ID mapping for all languages
	 * @returns Map of language codes to text IDs
	 */
	getTextIdMapping(): Record<string, string> {
		return { ...this.config.contentSource?.textIdsByLanguage };
	}

	/**
	 * Destroy the popup instance
	 */
	destroy(): void {
		this.clearShowTimeout();
		this.clearHideTimeout();
		// Remove keyboard event listener
		document.removeEventListener('keydown', this.handleKeyDown);
		if (this.popup && this.popup.parentNode) {
			this.popup.parentNode.removeChild(this.popup);
		}
		this.cache.clear();
	}
}

/**
 * Create a verse popup instance
 * @param options - Configuration options
 * @returns Popup instance
 */
export function createVersePopup(options: PartialVerseDetectionConfig = {}): VersePopup {
	return new VersePopup(options);
}

export default VersePopup;
