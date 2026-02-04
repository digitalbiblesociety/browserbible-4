/**
 * SocialShareHandler Module
 *
 * Handles social sharing functionality for verse popups.
 * Provides utilities for building share UI and handling share actions.
 */

import type { ParsedReference } from './VersePopup.js';

/** Social share icons for various platforms */
export const SOCIAL_ICONS: Record<string, string> = {
	facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
	x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
	bluesky: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.296 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>`,
	copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
};

/** Social share configuration */
export interface SocialShareConfig {
	showSocialShare: boolean;
	socialSharePlatforms?: ('facebook' | 'x' | 'bluesky' | 'copy')[];
	appBaseUrl: string;
}

/** Callback type for parsing verse reference */
export type ParseReferenceCallback = (reference: string) => ParsedReference | null;

/** Callback for showing copy feedback on popup element */
export type ShowCopyFeedbackCallback = (selector: string, className: string, duration: number) => void;

/**
 * Build HTML for social share buttons
 * @param config - Social share configuration
 * @returns HTML string for social share section, empty if disabled
 */
export function buildSocialShareHtml(config: SocialShareConfig): string {
	if (!config.showSocialShare) {
		return '';
	}

	const platforms = config.socialSharePlatforms || ['facebook', 'x', 'copy'];
	const buttons = platforms.map(platform => {
		const icon = SOCIAL_ICONS[platform] || '';
		const title = platform === 'copy' ? 'Copy to clipboard' : `Share on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
		return `<button class="verse-popup-social-btn ${platform}" data-platform="${platform}" title="${title}">${icon}</button>`;
	}).join('');

	return `<div class="verse-popup-social">${buttons}</div>`;
}

/**
 * Handle social share button click
 * @param platform - Social platform to share on
 * @param reference - Verse reference string
 * @param content - HTML content to share
 * @param appBaseUrl - Base URL for the app
 * @param parseReference - Callback to parse reference string
 * @param showCopyFeedback - Optional callback to show copy feedback on UI
 */
export function handleSocialShare(
	platform: string,
	reference: string,
	content: string,
	appBaseUrl: string,
	parseReference: ParseReferenceCallback,
	showCopyFeedback?: ShowCopyFeedbackCallback
): void {
	// Strip HTML tags from content for plain text
	const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
	const shareText = `"${plainText}" - ${reference}`;
	const parsed = parseReference(reference);
	const shareUrl = `${appBaseUrl}#${parsed?.sectionId || ''}`;

	switch (platform) {
		case 'facebook':
			window.open(
				`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareText)}&u=${encodeURIComponent(shareUrl)}`,
				'_blank',
				'width=600,height=400'
			);
			break;
		case 'x':
			window.open(
				`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
				'_blank',
				'width=600,height=400'
			);
			break;
		case 'bluesky':
			window.open(
				`https://bsky.app/intent/compose?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
				'_blank',
				'width=600,height=400'
			);
			break;
		case 'copy':
			navigator.clipboard.writeText(shareText).then(() => {
				// Show copied feedback via callback
				if (showCopyFeedback) {
					showCopyFeedback('.verse-popup-social-btn.copy', 'copied', 1500);
				}
			}).catch(err => {
				console.error('Failed to copy:', err);
			});
			break;
	}
}
