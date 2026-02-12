/**
 * LocalTextProvider - Loads texts from content/texts/{textid}/ directory
 */

import { getConfig } from '../core/config.js';
import { fetchTextInfo } from './fetchTextInfo.js';
import { TextSearch } from './Search.js';

const providerName = 'local';
const fullName = 'Local Files';
const textData = {};

function processFootnotes(content, notes) {
  for (const footnote of notes) {
    const noteLink = footnote.querySelector('a');
    const noteid = noteLink?.getAttribute('href') ?? null;
    const footnotetext = footnote.querySelector('.text');
    const noteintext = noteid && content ? content.querySelector(noteid) : null;

    if (noteintext && footnotetext) {
      noteintext.appendChild(footnotetext);
    }
  }
}

function processContent(content, textInfo, textid) {
  if (!content) return;

  content.setAttribute('data-textid', textid);
  content.setAttribute('data-lang3', textInfo.lang);

  // section headings go before chapter markers, not after
  const c = content.querySelector('.c');
  if (c) {
    const afterc = c.nextElementSibling;
    if (afterc?.classList.contains('s')) {
      c.parentNode.insertBefore(afterc, c);
    }
  }

  // verse numbers go before the verse element for CSS styling
  for (const vnum of content.querySelectorAll('.v-num')) {
    const v = vnum.closest('.v');
    if (v) v.parentNode.insertBefore(vnum, v);
  }
}

export function getTextManifest(callback) {
  const config = getConfig();
  const textsUrl = `${config.baseContentUrl}content/texts/${config.textsIndexPath}`;

  fetch(textsUrl)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      callback(data.textInfoData);
    })
    .catch(error => {
      console.error('Error loading text manifest:', textsUrl, error);

      if (typeof window !== 'undefined' && window.MovableWindow) {
        const modal = new window.MovableWindow(600, 250, 'Texts Error');
        const bodyEl = modal.body?.nodeType ? modal.body : modal.body?.[0];
        bodyEl.style.background = '#000';
        bodyEl.style.color = '#fff';
        bodyEl.innerHTML = `
          <div style="padding: 20px;">
            <p>Problem loading <code>${textsUrl}</code></p>
            <p>Error: ${error.message}</p>
          </div>`;
        modal.show().center();
      }
      callback(null);
    });
}

export function getTextInfo(textid, callback, errorCallback) {
  fetchTextInfo(textData, 'content/texts', textid, callback, errorCallback);
}

export function loadSection(textid, sectionid, callback, errorCallback) {
  getTextInfo(textid, textInfo => {
    const config = getConfig();
    const url = `${config.baseContentUrl}content/texts/${textid}/${sectionid}.html`;

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
        const notes = tempDiv.querySelectorAll('.footnotes .footnote');

        if (notes.length > 0) processFootnotes(content, notes);
        processContent(content, textInfo, textid);

        const wrapperDiv = document.createElement('div');
        if (content) wrapperDiv.appendChild(content);
        callback(wrapperDiv.innerHTML);
      })
      .catch(error => {
        errorCallback?.(textid, sectionid);
      });
  });
}

export function startSearch(textid, divisions, text, onSearchLoad, onSearchIndexComplete, onSearchComplete) {
  const textSearch = new TextSearch();

  textSearch.on('load', onSearchLoad);
  textSearch.on('indexcomplete', onSearchIndexComplete);
  textSearch.on('complete', onSearchComplete);

  textSearch.start(textid, divisions, text);
}

export const LocalTextProvider = {
  name: providerName,
  fullName,
  getTextManifest,
  getTextInfo,
  loadSection,
  startSearch
};

export default LocalTextProvider;
