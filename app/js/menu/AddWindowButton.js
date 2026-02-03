/**
 * AddWindowButton
 * Buttons to add new windows
 */

import { getConfig } from '../core/config.js';
import { getAllWindowTypes, getApp } from '../core/registry.js';
import { PlaceKeeper } from '../common/Navigation.js';

// Store init data for buttons
const buttonData = new WeakMap();

/**
 * Create add window buttons
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement} Last button element
 */
export function AddWindowButton(_parentNode, _menu) {
  const config = getConfig();
  const buttonMenu = document.querySelector('#main-menu-windows-list');
  const windowTools = [];
  const windowTypes = getAllWindowTypes();

  if (config.windowTypesOrder?.length > 0) {
    for (const windowTypeName of config.windowTypesOrder) {
      let winType = windowTypes.filter(wt => wt.className === windowTypeName);

      if (winType.length > 0) {
        winType = winType[0];

        windowTools.push({
          type: winType.className,
          label: winType.param,
          data: winType.init ?? {}
        });
      }
    }
  } else {
    for (const winType of windowTypes) {
      windowTools.push({
        type: winType.className,
        label: winType.param,
        data: winType.init ?? {}
      });
    }
  }

  let addButton;
  for (const tool of windowTools) {
    addButton = document.createElement('div');
    addButton.className = 'main-menu-item window-add i18n';
    addButton.id = `add-${tool.type}`;
    addButton.setAttribute('data-i18n', `[html]windows.${tool.label}.label`);

    if (buttonMenu) {
      buttonMenu.appendChild(addButton);
    }
    buttonData.set(addButton, tool);
  }

  if (buttonMenu) {
    buttonMenu.addEventListener('click', (e) => {
      const label = e.target.closest('.window-add');
      if (!label) return;

      const settings = buttonData.get(label);
      if (!settings) return;

      const app = getApp();

      // when starting a bible or commentary window, try to match it up with the others
      if (settings.type === 'BibleWindow' || settings.type === 'CommentaryWindow') {
        const firstBCWindow = app?.windowManager?.getWindows().filter(w => w.className === 'BibleWindow' || w.className === 'CommentaryWindow')[0] ?? null;
        const currentData = firstBCWindow?.getData() ?? null;

        if (currentData !== null) {
          settings.data.fragmentid = currentData.fragmentid;
          settings.data.sectionid = currentData.sectionid;
        } else {
          const fragmentid = config.newWindowFragmentid ?? 'JN1_1';
          const sectionid = fragmentid.split('_')[0];

          settings.data.fragmentid = fragmentid;
          settings.data.sectionid = sectionid;
        }
      }

      if (PlaceKeeper) PlaceKeeper.storePlace();
      if (app?.windowManager) {
        app.windowManager.add(settings.type, settings.data);
      }
      if (PlaceKeeper) PlaceKeeper.restorePlace();
    });
  }

  return addButton;
}

export default AddWindowButton;
