/**
 * CrossReferencePopupPlugin
 * Shows popup with Bible reference content on hover/click
 */

import { getConfig } from '../core/config.js';
import { InfoWindow } from '../ui/InfoWindow.js';
const hasTouch = 'ontouchend' in document;
import { Reference } from '../bible/BibleReference.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { PlaceKeeper } from '../common/PlaceKeeper.js';
import { TextNavigation } from '../common/TextNavigation.js';

// Store global handlers for cross-plugin communication
let handleBibleRefClick = null;
let handleBibleRefMouseover = null;
let handleBibleRefMouseout = null;

/**
 * Remove notes from a verse element
 * @param {Element} verse - The verse element to process
 */
const removeNotesFromVerse = (verse) => {
  verse.querySelectorAll('.note').forEach((note) => {
    note.parentNode.removeChild(note);
  });
};

/**
 * Create a cross reference popup plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const CrossReferencePopupPlugin = (app) => {
  const config = getConfig();

  if (!config.enableCrossReferencePopupPlugin) {
    return {};
  }

  const referencePopup = InfoWindow('CrossReferencePopup');

  const containerEl = referencePopup.container;
  containerEl.classList.add('info-window-elevated');

  const getFragmentidFromNode = (node) => {
    const possibleTexts = [node.getAttribute('data-id'), node.getAttribute('title'), node.innerHTML];
    let fragmentid = null;

    for (const text of possibleTexts) {
      if (text != null) {
        const bref = new Reference(text.split(';')[0].trim());
        if (typeof bref.toSection !== 'undefined') {
          fragmentid = bref.toSection();
          break;
        }
      }
    }

    return fragmentid;
  };

  handleBibleRefClick = function(e) {
    const link = this;
    const newfragmentid = getFragmentidFromNode(link);

    // where are we?
    const currentLocationData = PlaceKeeper.getFirstLocation();

    // store the current one
    TextNavigation.locationChange(currentLocationData.fragmentid);

    if (newfragmentid != null && newfragmentid !== '') {
      TextNavigation.locationChange(newfragmentid);

      ext.trigger('globalmessage', {
        type: 'globalmessage',
        target: this,
        data: {
          messagetype: 'nav',
          type: 'bible',
          locationInfo: {
            fragmentid: newfragmentid,
            sectionid: newfragmentid.split('_')[0],
            offset: 0
          }
        }
      });
    }
  };

  handleBibleRefMouseover = function(e, textid) {
    const link = this;
    const fragmentid = getFragmentidFromNode(link);

    if (fragmentid !== null) {
      const sectionid = fragmentid.split('_')[0];

      if (typeof textid === 'undefined') {
        const section = link.closest('.section');
        if (section?.classList.contains('commentary')) {
          const firstBibleSection = document.querySelector('.BibleWindow .section');
          textid = firstBibleSection?.getAttribute('data-textid') ?? '';
        } else if (section) {
          textid = section.getAttribute('data-textid');
        }
      }

      // Get TextLoader from global if available
      const TextLoader = window.TextLoader;

      if (TextLoader) {
        TextLoader.getText(textid, (textInfo) => {
          TextLoader.loadSection(textInfo, sectionid, (contentNode) => {
            let contentEl;
            if (typeof contentNode === 'string') {
              const temp = document.createElement('div');
              temp.innerHTML = contentNode;
              contentEl = temp;
            } else {
              contentEl = contentNode;
            }

            const verseEls = contentEl.querySelectorAll(`.${fragmentid}`);
            let html = '';

            for (const verse of verseEls) {
              removeNotesFromVerse(verse);
              html += verse.innerHTML;
            }

            referencePopup.body.innerHTML = html;
            referencePopup.show();
            referencePopup.position(link);
          });
        });
      }
    }
  };

  handleBibleRefMouseout = function(e) {
    referencePopup.hide();
  };

  const windowsMain = document.querySelector('.windows-main');
  if (windowsMain) {
    windowsMain.addEventListener('click', (e) => {
      const target = e.target.closest('.bibleref, .xt');
      if (target) handleBibleRefClick.call(target, e);
    });

    if (!hasTouch) {
      windowsMain.addEventListener('mouseover', (e) => {
        const target = e.target.closest('.bibleref, .xt');
        if (target) handleBibleRefMouseover.call(target, e);
      });
      windowsMain.addEventListener('mouseout', (e) => {
        const target = e.target.closest('.bibleref, .xt');
        if (target) handleBibleRefMouseout.call(target, e);
      });
    }
  }

  let ext = {
    getData() {
      return null;
    }
  };

  mixinEventEmitter(ext);

  return ext;
};

// Export handlers for use by other plugins
export const getBibleRefClickHandler = () => handleBibleRefClick;

export const getBibleRefMouseoverHandler = () => handleBibleRefMouseover;

export const getBibleRefMouseoutHandler = () => handleBibleRefMouseout;

export default CrossReferencePopupPlugin;
