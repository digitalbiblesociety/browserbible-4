/**
 * NotesPopupPlugin
 * Shows popup with footnotes and notes content
 */

import { deepMerge } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { InfoWindow } from '../ui/InfoWindow.js';
const hasTouch = 'ontouchend' in document;
import { EventEmitterMixin } from '../common/EventEmitter.js';
import {
  getBibleRefClickHandler,
  getBibleRefMouseoverHandler,
  getBibleRefMouseoutHandler
} from './CrossReferencePopupPlugin.js';

/**
 * Create a notes popup plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const NotesPopupPlugin = (app) => {
  const config = getConfig();

  if (!config.enableNotesPopupPlugin) {
    return {};
  }

  const notesPopup = InfoWindow('NotesPopup');

  const notesPopupBody = notesPopup.body;

  // Handle clicks on bible refs within notes
  notesPopupBody.addEventListener('click', (e) => {
    const target = e.target.closest('.bibleref, .xt');
    if (target) {
      const handler = getBibleRefClickHandler();
      if (handler) {
        handler.call(target, e);
      }
      notesPopup.hide();
    }
  });

  if (!hasTouch) {
    notesPopupBody.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.bibleref, .xt');
      if (target) {
        const section = notesPopup.currentWord?.closest('.section');
        const textid = section?.getAttribute('data-textid') ?? '';
        const handler = getBibleRefMouseoverHandler();
        if (handler) {
          handler.call(target, e, textid);
        }
      }
    });

    notesPopupBody.addEventListener('mouseout', (e) => {
      const target = e.target.closest('.bibleref, .xt');
      if (target) {
        const handler = getBibleRefMouseoutHandler();
        if (handler) {
          handler.call(target, e);
        }
      }
    });
  }

  const windowsMain = document.querySelector('.windows-main');
  if (windowsMain) {
    windowsMain.addEventListener('click', (e) => {
      const key = e.target.closest('.note .key, .cf .key');
      if (key) {
        e.preventDefault();

        const containerEl = notesPopup.container;

        // hide if second click
        if (containerEl.style.display !== 'none' && notesPopup.currentWord === key) {
          notesPopup.hide();
          notesPopup.currentWord = null;
          return;
        }
        notesPopup.currentWord = key;

        // clone and attach content
        const parent = key.parentNode;
        const textEl = parent.querySelector('.text');
        const content = textEl?.cloneNode(true) ?? null;

        notesPopupBody.innerHTML = '';
        if (content) {
          notesPopupBody.appendChild(content);
        }

        // show popup
        notesPopup.show();
        notesPopup.position(key);
      }
    });
  }

  let ext = {
    getData() {
      return null;
    }
  };

  ext = deepMerge(ext, EventEmitterMixin);

  return ext;
};

export default NotesPopupPlugin;
