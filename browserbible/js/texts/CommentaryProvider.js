/**
 * CommentaryProvider - Loads commentaries from content/commentaries/{textid}/ directory
 */

import { getConfig } from '../core/config.js';
import { fetchTextInfo } from './fetchTextInfo.js';

const providerName = 'commentary';
const fullName = 'Local Commentaries';
const textData = {};

export function getTextManifest(callback) {
	const config = getConfig();
	const url = `${config.baseContentUrl}content/commentaries/commentaries.json`;

	fetch(url)
		.then(response => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return response.json();
		})
		.then(data => {
			callback(data.textInfoData);
		})
		.catch(error => {
			console.error('Error loading commentary manifest:', url, error);
			callback(null);
		});
}

export function getTextInfo(textid, callback, errorCallback) {
	fetchTextInfo(textData, 'content/commentaries', textid, callback, errorCallback);
}

export function loadSection(textid, sectionid, callback, errorCallback) {
	getTextInfo(textid, textInfo => {
		const config = getConfig();
		const url = `${config.baseContentUrl}content/commentaries/${textid}/${sectionid}.html`;

		fetch(url)
			.then(response => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return response.text();
			})
			.then(text => {
				const htmlContent = text.includes('</head>') ? text.split('</head>')[1] : text;
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = htmlContent;

				const content = tempDiv.querySelector('.section');
				if (content) {
					content.setAttribute('data-textid', textid);
				}

				const wrapperDiv = document.createElement('div');
				if (content) wrapperDiv.appendChild(content);
				callback(wrapperDiv.innerHTML);
			})
			.catch(error => {
				errorCallback?.(textid, sectionid);
			});
	}, errorCallback);
}

export const CommentaryProvider = {
	name: providerName,
	fullName,
	getTextManifest,
	getTextInfo,
	loadSection
};

export default CommentaryProvider;
