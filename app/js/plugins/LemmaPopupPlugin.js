/**
 * LemmaPopupPlugin
 * Shows popup with Strong's number details when clicking on words
 */

import { on, closest, toElement } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import { getApp } from '../core/registry.js';
import { i18n } from '../lib/i18n.js';
import { InfoWindow } from '../ui/InfoWindow.js';
import { NT_BOOKS, OT_BOOKS, AP_BOOKS } from '../bible/BibleData.js';
import { morphology } from '../bible/Morphology.js';

// Default config
updateConfig({
  enableLemmaPopupPlugin: true
});

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

  const containerEl = toElement(lemmaPopup.container);

  // Define loadStrongsData before it's used in the click handler
  const loadStrongsData = (textid, strongsNumber, morphKey, morphType, langPrefix, langCode, dir, l) => {
    fetch(`${config.baseContentUrl}content/lexicons/strongs/entries/${langPrefix}${strongsNumber}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        let html = `<div class="lemma-word">` +
          `<span lang="${langCode}" dir="${dir}">${data.lemma}</span>` +
          ` ` +
          `<span class="lemma-strongs" dir="ltr"> (${strongsNumber})</span>` +
          `</div>`;

        if (morphKey !== '' && morphology[morphType]) {
          html += `<span class="lemma-morphology">${morphology[morphType].format(morphKey)}</span>`;
        }

        html += `<span class="lemma-findall" data-lemma="${langPrefix}${strongsNumber}" data-textid="${textid}">` +
          `${i18n.t('plugins.lemmapopup.findalloccurrences', { count: data.frequency })}` +
          `</span>`;

        html += `<div class="lemma-outline">${data.outline}</div>`;

        const bodyEl = toElement(lemmaPopup.body);
        bodyEl.classList.remove('loading-indicator');
        bodyEl.insertAdjacentHTML('beforeend', html);
        lemmaPopup.position(l);
      })
      .catch(() => {
        const bodyEl = toElement(lemmaPopup.body);
        bodyEl.innerHTML = `Error loading ... ${langPrefix}${strongsNumber}`;
      });
  };

  // Event handler that uses `this` - keep as regular function
  on(containerEl, 'click', '.lemma-findall', function(e) {
    const link = this;
    const lemma = link.getAttribute('data-lemma');
    const textid = link.getAttribute('data-textid');

    const appInstance = getApp();
    if (appInstance?.windowManager) {
      appInstance.windowManager.add('SearchWindow', { searchtext: lemma, textid });
    }

    lemmaPopup.hide();
  });

  const windowsMain = document.querySelector('.windows-main');
  if (windowsMain) {
    // Event handler that uses `this` - keep as regular function
    on(windowsMain, 'click', '.BibleWindow l', function(e) {
      const l = this;

      if (containerEl.style.display !== 'none') {
        lemmaPopup.hide();
        if (lemmaPopup.currentWord === l) {
          lemmaPopup.currentWord = null;
          l.classList.remove('selected-lemma');
          return;
        }
      }

      lemmaPopup.currentWord = l;

      document.querySelectorAll('.selected-lemma').forEach((el) => {
        el.classList.remove('selected-lemma');
      });
      l.classList.add('selected-lemma');

      const morph = l.getAttribute('m');
      const morphs = (morph != null) ? morph.split(' ') : [];

      const strong = l.getAttribute('s');
      const strongs = (strong != null) ? strong.replace(/H/gi, '').replace(/G/gi, '').split(' ') : [];

      const verse = closest(l, '.verse, .v');
      const verseCode = verse?.getAttribute('data-id') ?? '';
      const bookId = verseCode.substring(0, 2);
      const chapter = closest(l, '.chapter');
      const textid = chapter?.getAttribute('data-textid') ?? '';

      let langPrefix = 'G';
      let langCode = 'el';
      let morphType = 'Greek';
      let dir = 'ltr';

      // Convert strongs to integers
      for (let i = 0; i < strongs.length; i++) {
        strongs[i] = parseInt(strongs[i], 10);
      }

      // Check for language
      const section = closest(l, '.section');
      const sectionLang = section?.getAttribute('lang') ?? '';

      if (sectionLang === 'el' ||
        sectionLang === 'gr' ||
        sectionLang === 'grc' ||
        sectionLang === 'grk' ||
        NT_BOOKS.indexOf(bookId) > -1 ||
        AP_BOOKS.indexOf(bookId) > -1) {
        langPrefix = 'G';
        langCode = 'el';
        dir = 'ltr';
        morphType = 'Greek';
      } else if (sectionLang === 'he' ||
        sectionLang === 'heb' ||
        OT_BOOKS.indexOf(bookId) > -1) {
        langPrefix = 'H';
        langCode = 'he';
        dir = 'rtl';
        morphType = 'Hebrew';
      }

      // Remove articles (G3588 and H853) when there is more than one
      if (strongs.length > 0) {
        let articleIndex = -1;

        for (let i = 0; i < strongs.length; i++) {
          if ((strongs[i] === 3588 && langPrefix === 'G') || (strongs[i] === 853 && langPrefix === 'H')) {
            articleIndex = i;
            break;
          }
        }

        if (articleIndex > -1) {
          strongs.splice(articleIndex, 1);
          if (morphs.length > articleIndex) {
            morphs.splice(articleIndex, 1);
          }
        }
      }

      // Show popup
      lemmaPopup.show();
      lemmaPopup.position(l);

      const bodyEl = toElement(lemmaPopup.body);
      bodyEl.innerHTML = 'Loading...';

      if (strongs.length > 0) {
        bodyEl.innerHTML = '';
        bodyEl.classList.add('loading-indicator');

        for (const [i, strongNum] of strongs.entries()) {
          loadStrongsData(textid, strongNum, i < morphs.length ? morphs[i] : '', morphType, langPrefix, langCode, dir, l);
        }
      }
    });
  }

  return {};
}

export default LemmaPopupPlugin;
