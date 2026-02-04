/**
 * ConfigToggles
 * Toggle switches for various display options
 */

import { createElements } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { PlaceKeeper } from '../common/Navigation.js';

/**
 * Create toggle settings controls
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function ConfigToggles(_parentNode, _menu) {
  const config = getConfig();

  const body = document.querySelector('#config-type .config-body');
  const toggleNames = config.settingToggleNames ?? [];
  const toggleDefaults = config.settingToggleDefaults ?? [];

  const setToggle = (toggleId, checked) => {
    PlaceKeeper?.storePlace();

    const toggle = document.querySelector(`#config-toggle-${toggleId}`);
    const onClass = `toggle-${toggleId}-on`;
    const offClass = `toggle-${toggleId}-off`;

    if (checked === true || checked === 'true') {
      if (toggle) {
        toggle.classList.add('toggle-on');
        const input = toggle.querySelector('input');
        if (input) input.checked = true;
      }
      document.body.classList.add(onClass);
      document.body.classList.remove(offClass);
    } else {
      if (toggle) {
        toggle.classList.remove('toggle-on');
        const input = toggle.querySelector('input');
        if (input) input.checked = false;
      }
      document.body.classList.remove(onClass);
      document.body.classList.add(offClass);
    }

    PlaceKeeper?.restorePlace();

    AppSettings.setValue(toggleId, { checked });
  };

  if (!config.enableSettingToggles) {
    for (const [i, toggleName] of toggleNames.entries()) {
      setToggle(toggleName.replace(/\s/gi, '').toLowerCase(), toggleDefaults[i]);
    }
    return;
  }

  const createToggle = (toggleName, defaultValue) => {
    const toggleId = toggleName.replace(/\s/gi, '').toLowerCase();
    const toggleDefaultSetting = { checked: defaultValue };
    const toggleSetting = AppSettings.getValue(toggleId, toggleDefaultSetting);
    const toggle = createElements(`<div id="config-toggle-${toggleId}" class="config-toggle">` +
      `<input id="config-toggle-${toggleId}-input" type="checkbox" value="${toggleId}" />` +
      `<label for="config-toggle-${toggleId}-input" title="${toggleName}">${toggleName}</label>` +
      `</div>`);

    body?.appendChild(toggle);

    const input = toggle.querySelector('input');
    if (input) {
      // Use regular function here because we need `this` binding for the event handler
      input.addEventListener('click', function() {
        const checked = this.checked;
        const value = this.value;
        setToggle(value, checked);
      }, false);
    }

    setToggle(toggleId, toggleSetting.checked);
  };

  for (const [i, toggleName] of toggleNames.entries()) {
    createToggle(toggleName, toggleDefaults[i]);
  }
}

export default ConfigToggles;
