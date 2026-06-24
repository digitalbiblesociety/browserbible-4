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

export function ConfigToggles() {
  const config = getConfig();

  const body = document.querySelector('#config-type .config-body');
  const togglesContainer = elem('div', { className: 'config-toggles' });
  body?.appendChild(togglesContainer);
  const toggleNames = config.settingToggleNames ?? [];
  const toggleDefaults = config.settingToggleDefaults ?? [];

  const setToggle = (toggleId, checked) => {
    const isOn = checked === true || checked === 'true';

    PlaceKeeper.preservePlace(() => {
      const toggle = document.querySelector(`#config-toggle-${toggleId}`);
      if (toggle) {
        toggle.classList.toggle('toggle-on', isOn);
        const input = toggle.querySelector('input');
        if (input) input.checked = isOn;
      }
      document.body.classList.toggle(`toggle-${toggleId}-on`, isOn);
      document.body.classList.toggle(`toggle-${toggleId}-off`, !isOn);
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
    const toggleSetting = AppSettings.getValue(toggleId, { checked: defaultValue });
    const input = elem('input', { id: `config-toggle-${toggleId}-input`, type: 'checkbox', value: toggleId });
    const label = elem('label', { htmlFor: `config-toggle-${toggleId}-input`, title: toggleName });

    const svgMarkup = toggleIcons[toggleId];
    if (svgMarkup) {
      label.innerHTML = svgMarkup;
    } else {
      label.textContent = toggleName;
    }

    togglesContainer.appendChild(
      elem('div', { id: `config-toggle-${toggleId}`, className: 'config-toggle' }, input, label)
    );

    input.addEventListener('click', () => setToggle(input.value, input.checked));

    setToggle(toggleId, toggleSetting.checked);
  };

  for (const [i, toggleName] of toggleNames.entries()) {
    createToggle(toggleName, toggleDefaults[i]);
  }
}
