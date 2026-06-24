/**
 * Font size slider control
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { PlaceKeeper } from '../common/PlaceKeeper.js';

export function FontSizeSettings() {
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
  document.head.appendChild(elem('style', styleCode));

  if (!config.enableFontSizeSelector) {
    setFontSize(fontSizeDefault);
    return;
  }

  const body = document.querySelector('#config-type .config-body');
  const fontSizeKey = 'config-font-size';
  const defaultFontSizeSetting = { fontSize: fontSizeDefault };
  const fontSizeSetting = AppSettings.getValue(fontSizeKey, defaultFontSizeSetting);

  const rangeInput = elem('input', {
    type: 'range',
    className: 'settings-slider',
    min: fontSizeMin,
    max: fontSizeMax,
    step: fontSizeStep,
    value: fontSizeSetting.fontSize,
    style: { width: '100%' }
  });

  body?.appendChild(elem('div', { id: 'font-size-container', className: 'font-size-control' },
    elem('span', { className: 'font-size-icon font-size-small' }, 'A'),
    elem('div', { style: { flex: '1' } }, rangeInput),
    elem('span', { className: 'font-size-icon font-size-large' }, 'A')
  ));

  const setFontSize = (newFontSize) => {
    PlaceKeeper.preservePlace(() => {
      // newFontSize may be a string (from input.value); compare via the built class name
      const selectedClass = `config-font-size-${newFontSize}`;
      for (let size = fontSizeMin; size <= fontSizeMax; size += fontSizeStep) {
        const className = `config-font-size-${size}`;
        document.body.classList.toggle(className, className === selectedClass);
      }

      AppSettings.setValue(fontSizeKey, { fontSize: newFontSize });
    });
  };

  // handleFontSizeChange needs `this` context, so keep as regular function
  function handleFontSizeChange() {
    setFontSize(this.value);
  }

  rangeInput.addEventListener('change', handleFontSizeChange);
  rangeInput.addEventListener('input', handleFontSizeChange);

  setFontSize(fontSizeSetting.fontSize);
}
