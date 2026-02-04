/**
 * FontSizeSettings
 * Font size slider control
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { PlaceKeeper } from '../common/Navigation.js';

/**
 * Create font size setting controls
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function FontSizeSettings(_parentNode, _menu) {
  const config = getConfig();

  const fontSizeMin = config.fontSizeMin ?? 14;
  const fontSizeMax = config.fontSizeMax ?? 28;
  const fontSizeStep = config.fontSizeStep ?? 2;
  const fontSizeDefault = config.fontSizeDefault ?? 18;

  // generate font sizes
  let styleCode = '';
  for (let size = fontSizeMin; size <= fontSizeMax; size += fontSizeStep) {
    styleCode += `.config-font-size-${size} .reading-text { font-size: ${size}px; }`;
  }
  const styleEl = elem('style', { textContent: styleCode });
  document.head.appendChild(styleEl);

  if (!config.enableFontSizeSelector) {
    setFontSize(fontSizeDefault);
    return;
  }

  const body = document.querySelector('#config-type .config-body');
  const fontSizeKey = 'config-font-size';
  const defaultFontSizeSetting = { fontSize: fontSizeDefault };
  const fontSizeSetting = AppSettings.getValue(fontSizeKey, defaultFontSizeSetting);

  const container = elem('div', {
    id: 'font-size-container',
    style: { display: 'flex', alignItems: 'center', gap: '8px' }
  });
  const span1 = elem('span', { textContent: 'A', style: { fontSize: `${fontSizeMin}px` } });
  const sliderWrapper = elem('div', { style: { flex: '1' } });
  const span2 = elem('span', { textContent: 'A', style: { fontSize: `${fontSizeMax}px` } });
  container.append(span1, sliderWrapper, span2);
  body?.appendChild(container);

  // HTML5 range control (IE10+, FF35+)
  const rangeInput = elem('input', {
    type: 'range',
    min: fontSizeMin,
    max: fontSizeMax,
    step: fontSizeStep,
    value: fontSizeSetting.fontSize,
    style: { width: '100%' }
  });
  sliderWrapper.appendChild(rangeInput);

  // Define setFontSize before handleFontSizeChange
  const setFontSize = (newFontSize) => {
    PlaceKeeper?.storePlace();

    // remove all others
    for (let size = fontSizeMin; size <= fontSizeMax; size += fontSizeStep) {
      const className = `config-font-size-${size}`;
      document.body.classList.remove(className);
    }

    document.body.classList.add(`config-font-size-${newFontSize}`);

    AppSettings.setValue(fontSizeKey, { fontSize: newFontSize });

    PlaceKeeper?.restorePlace();
  };

  // handleFontSizeChange needs `this` context, so keep as regular function
  function handleFontSizeChange() {
    setFontSize(this.value);
  }

  rangeInput.addEventListener('change', handleFontSizeChange, false);
  rangeInput.addEventListener('input', handleFontSizeChange, false);

  setFontSize(fontSizeSetting.fontSize);
}

export default FontSizeSettings;
