/**
 * ConfigToggles
 * Toggle switches for various display options
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { PlaceKeeper } from '../common/PlaceKeeper.js';

import versesSvg from '../../css/images/toggles/verses.svg?raw';
import chaptersSvg from '../../css/images/toggles/chapters.svg?raw';
import titlesSvg from '../../css/images/toggles/titles.svg?raw';
import notesSvg from '../../css/images/toggles/notes.svg?raw';
import christwordsSvg from '../../css/images/toggles/christwords.svg?raw';
import justifySvg from '../../css/images/toggles/justify.svg?raw';
import mediaSvg from '../../css/images/toggles/media.svg?raw';

const toggleIcons = {
  verses: versesSvg,
  chapters: chaptersSvg,
  titles: titlesSvg,
  notes: notesSvg,
  wordsofchrist: christwordsSvg,
  justify: justifySvg,
  media: mediaSvg,
};

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
    PlaceKeeper.preservePlace(() => {
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
    });

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
    const input = elem('input', { id: `config-toggle-${toggleId}-input`, type: 'checkbox', value: toggleId });
    const label = elem('label', { htmlFor: `config-toggle-${toggleId}-input`, title: toggleName });

    const svgMarkup = toggleIcons[toggleId];
    if (svgMarkup) {
      label.innerHTML = svgMarkup;
    } else {
      label.textContent = toggleName;
    }

    const toggle = elem('div', { id: `config-toggle-${toggleId}`, className: 'config-toggle' }, input, label);

    body?.appendChild(toggle);
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
