/**
 * LemmaPopupPlugin
 * Shows popup with Strong's number details when clicking on words
 */

import { getConfig } from '../core/config.js';
import { getApp } from '../core/registry.js';
import { i18n } from '../lib/i18n.js';
import { InfoWindow } from '../ui/InfoWindow.js';
import { OT_BOOKS } from '../bible/BibleData.js';
import { morphology } from '../bible/Morphology.js';
import { elem } from '../lib/helpers.esm.js';

// Article Strong's numbers to filter out when multiple words present
const GREEK_ARTICLE = 3588;  // G3588 - the Greek definite article
const HEBREW_ARTICLE = 853;  // H853 - the Hebrew direct object marker

// Language configurations
const GREEK_CONFIG = { langPrefix: 'G', langCode: 'el', dir: 'ltr', morphType: 'Greek' };
const HEBREW_CONFIG = { langPrefix: 'H', langCode: 'he', dir: 'rtl', morphType: 'Hebrew' };

const HEBREW_SECTION_LANGS = ['he', 'heb'];

/**
 * Determine language config based on section language or book ID
 */
function getLangConfig(sectionLang, bookId) {
  if (HEBREW_SECTION_LANGS.includes(sectionLang) || OT_BOOKS.includes(bookId)) {
    return HEBREW_CONFIG;
  }
  // Default to Greek for NT, Apocrypha, or Greek section languages
  return GREEK_CONFIG;
}

/**
 * Remove article from strongs/morphs arrays if present
 * Returns true if article was removed
 */
function removeArticle(strongs, morphs, langPrefix) {
  const articleNum = langPrefix === 'G' ? GREEK_ARTICLE : HEBREW_ARTICLE;
  const articleIndex = strongs.indexOf(articleNum);

  if (articleIndex > -1) {
    strongs.splice(articleIndex, 1);
    if (morphs.length > articleIndex) {
      morphs.splice(articleIndex, 1);
    }
    return true;
  }
  return false;
}

/**
 * Parse strongs attribute into array of integers
 */
function parseStrongs(strongAttr) {
  if (!strongAttr) return [];
  return strongAttr
    .replace(/[GH]/gi, '')
    .split(' ')
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n));
}

/**
 * Parse morph attribute into array
 */
function parseMorphs(morphAttr) {
  return morphAttr ? morphAttr.split(' ') : [];
}

/**
 * Create a lemma popup plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export function LemmaPopupPlugin(app) {
  const config = getConfig();

  if (!config.enableLemmaPopupPlugin) {
    return {};
  }

  const lemmaPopup = InfoWindow('lemma-popup');

  lemmaPopup.on('hide', () => {
    document.querySelectorAll('.selected-lemma').forEach((el) => {
      el.classList.remove('selected-lemma');
    });
  });

  const containerEl = lemmaPopup.container;
  const bodyEl = lemmaPopup.body;

  /**
   * Load and display Strong's data for a word
   */
  function loadStrongsData(opts) {
    const { textid, strongsNumber, morphKey, langConfig, targetEl } = opts;
    const url = `${config.baseContentUrl}content/lexicons/strongs/entries/${langConfig.langPrefix}${strongsNumber}.json`;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const elements = buildLemmaElements({ data, strongsNumber, morphKey, langConfig, textid });
        bodyEl.classList.remove('loading-indicator');
        bodyEl.append(...elements);
        lemmaPopup.position(targetEl);
      })
      .catch(() => {
        bodyEl.innerHTML = `Error loading ... ${langConfig.langPrefix}${strongsNumber}`;
      });
  }

  /**
   * Build DOM elements for lemma display
   */
  function buildLemmaElements(opts) {
    const { data, strongsNumber, morphKey, langConfig, textid } = opts;
    const { langPrefix, langCode, dir, morphType } = langConfig;

    const wordDiv = elem('div', { className: 'lemma-word' },
      elem('span', { lang: langCode, dir }, data.lemma),
      elem('span', { className: 'lemma-strongs', dir: 'ltr' }, `(${strongsNumber})`)
    );

    return [
      wordDiv,
      morphKey && morphology[morphType] && elem('span', { className: 'lemma-morphology', innerHTML: morphology[morphType].format(morphKey) }),
      elem('span', {
        className: 'lemma-findall',
        textContent: i18n.t('plugins.lemmapopup.findalloccurrences', { count: data.frequency }),
        dataset: { lemma: `${langPrefix}${strongsNumber}`, textid }
      }),
      elem('div', { className: 'lemma-outline', innerHTML: data.outline })
    ].filter(Boolean);
  }

  /**
   * Handle click on "find all occurrences" link
   */
  containerEl.addEventListener('click', (e) => {
    const link = e.target.closest('.lemma-findall');
    if (!link) return;

    const lemma = link.getAttribute('data-lemma');
    const textid = link.getAttribute('data-textid');

    const appInstance = getApp();
    if (appInstance?.windowManager) {
      appInstance.windowManager.add('SearchWindow', { searchtext: lemma, textid });
    }

    lemmaPopup.hide();
  });

  /**
   * Handle click on lemma word in Bible text
   */
  const windowsMain = document.querySelector('.windows-main');
  if (windowsMain) {
    windowsMain.addEventListener('click', (e) => {
      const lemmaEl = e.target.closest('.BibleWindow l');
      if (!lemmaEl) return;

      // Toggle popup if clicking same word
      if (containerEl.style.display !== 'none' && lemmaPopup.currentWord === lemmaEl) {
        lemmaPopup.hide();
        lemmaPopup.currentWord = null;
        lemmaEl.classList.remove('selected-lemma');
        return;
      }

      // Hide any existing popup
      if (containerEl.style.display !== 'none') {
        lemmaPopup.hide();
      }

      lemmaPopup.currentWord = lemmaEl;
      document.querySelectorAll('.selected-lemma').forEach((el) => el.classList.remove('selected-lemma'));
      lemmaEl.classList.add('selected-lemma');

      // Parse attributes
      const strongs = parseStrongs(lemmaEl.getAttribute('s'));
      const morphs = parseMorphs(lemmaEl.getAttribute('m'));

      // Get context info using native closest()
      const verse = lemmaEl.closest('.verse, .v');
      const bookId = verse?.getAttribute('data-id')?.substring(0, 2) ?? '';
      const chapter = lemmaEl.closest('.chapter');
      const textid = chapter?.getAttribute('data-textid') ?? '';
      const section = lemmaEl.closest('.section');
      const sectionLang = section?.getAttribute('lang') ?? '';

      // Determine language
      const langConfig = getLangConfig(sectionLang, bookId);

      // Remove article if multiple words
      if (strongs.length > 1) {
        removeArticle(strongs, morphs, langConfig.langPrefix);
      }

      // Show popup with loading state
      lemmaPopup.show();
      lemmaPopup.position(lemmaEl);

      if (strongs.length === 0) {
        bodyEl.innerHTML = 'No Strong\'s data available';
        return;
      }

      bodyEl.innerHTML = '';
      bodyEl.classList.add('loading-indicator');

      // Load data for each Strong's number
      for (let i = 0; i < strongs.length; i++) {
        loadStrongsData({
          textid,
          strongsNumber: strongs[i],
          morphKey: morphs[i] || '',
          langConfig,
          targetEl: lemmaEl
        });
      }
    });
  }

  return {};
}

export default LemmaPopupPlugin;
