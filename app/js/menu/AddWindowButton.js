/**
 * AddWindowButton
 * Buttons to add new windows
 */

import { createElements, on, data, qs } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import { getAllWindowTypes, getApp } from '../core/registry.js';
import { PlaceKeeper } from '../common/Navigation.js';

// Default config
updateConfig({
  windowTypesOrder: []
});

/**
 * Create add window buttons
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement} Last button element
 */
export function AddWindowButton(_parentNode, _menu) {
  const config = getConfig();
  const buttonMenu = qs('#main-menu-windows-list');

  // create window buttons from window Types
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
    // build default array
    for (const winType of windowTypes) {
      windowTools.push({
        type: winType.className,
        label: winType.param,
        data: winType.init ?? {}
      });
    }
  }

  // add buttons
  let addButton;
  for (const tool of windowTools) {
    // ADD Button
    addButton = createElements(`<div class="main-menu-item window-add i18n" id="add-${tool.type}" data-i18n="[html]windows.${tool.label}.label"></div>`);
    if (buttonMenu) {
      buttonMenu.appendChild(addButton);
    }
    data(addButton, 'init', tool);
  }

  if (buttonMenu) {
    on(buttonMenu, 'click', '.window-add', function(e) {
      const label = this;
      const settings = data(label, 'init');
      console.log('AddWindowButton clicked, settings:', settings);
      const app = getApp();

      // when starting a bible or commentary window, try to match it up with the others
      if (settings.type === 'BibleWindow' || settings.type === 'CommentaryWindow') {
        // get location from first window
        const firstBCWindow = app?.windowManager?.getWindows().filter(w =>
          w.className === 'BibleWindow' || w.className === 'CommentaryWindow'
        )[0] ?? null;
        const currentData = firstBCWindow?.getData() ?? null;

        // if no location, then use the defaults from config
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
        console.log('Adding window type:', settings.type, 'with data:', settings.data);
        app.windowManager.add(settings.type, settings.data);
      }
      if (PlaceKeeper) PlaceKeeper.restorePlace();
    });
  }

  return addButton;
}

export default AddWindowButton;
