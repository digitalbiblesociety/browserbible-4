/**
 * NotesPopupPlugin
 * Shows popup with footnotes and notes content
 */

import { on, closest, deepMerge, toElement } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import { InfoWindow } from '../ui/InfoWindow.js';
const hasTouch = 'ontouchend' in document;
import { EventEmitterMixin } from '../common/EventEmitter.js';
import {
  getBibleRefClickHandler,
  getBibleRefMouseoverHandler,
  getBibleRefMouseoutHandler
} from './CrossReferencePopupPlugin.js';

// Default config
updateConfig({
  enableNotesPopupPlugin: true
});

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

  const notesPopupBody = toElement(notesPopup.body);

  // Handle clicks on bible refs within notes
  on(notesPopupBody, 'click', '.bibleref, .xt', function(e) {
    const handler = getBibleRefClickHandler();
    if (handler) {
      handler.call(this, e);
    }
    notesPopup.hide();
  });

  if (!hasTouch) {
    on(notesPopupBody, 'mouseover', '.bibleref, .xt', function(e) {
      const section = closest(notesPopup.currentWord, '.section');
      const textid = section?.getAttribute('data-textid') ?? '';
      const handler = getBibleRefMouseoverHandler();
      if (handler) {
        handler.call(this, e, textid);
      }
    });

    on(notesPopupBody, 'mouseout', '.bibleref, .xt', function(e) {
      const handler = getBibleRefMouseoutHandler();
      if (handler) {
        handler.call(this, e);
      }
    });
  }

  const windowsMain = document.querySelector('.windows-main');
  if (windowsMain) {
    on(windowsMain, 'click', '.note .key, .cf .key', function(e) {
      e.preventDefault();

      const key = this;

      const containerEl = toElement(notesPopup.container);

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

      return false;
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
