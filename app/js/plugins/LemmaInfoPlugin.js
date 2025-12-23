/**
 * LemmaInfoPlugin
 * Shows morphology info on hover over lemma elements
 */

import { on, closest, offset, createElements } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
const hasTouch = 'ontouchend' in document;
import { morphology } from '../bible/Morphology.js';

// Default config
updateConfig({
  enableLemmaInfoPlugin: true
});

/**
 * Create a lemma info plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const LemmaInfoPlugin = (app) => {
  const config = getConfig();

  if (!config.enableLemmaInfoPlugin) {
    return {};
  }

  const lemmaInfo = createElements('<div class="lemma-info"></div>');
  document.body.appendChild(lemmaInfo);
  lemmaInfo.style.display = 'none';

  if (!hasTouch) {
    const windowsMain = document.querySelector('.windows-main');

    if (windowsMain) {
      on(windowsMain, 'mouseover', '.BibleWindow l', function(e) {
        const l = this;
        const morph = l.getAttribute('m');
        const main = closest(l, '.scroller-main');
        const mainOffset = main ? offset(main) : { left: 0, top: 0 };
        const section = closest(l, '.section');
        const lang = section?.getAttribute('lang') ?? '';

        let morphologyType = '';
        if (lang === 'heb' || lang === 'he') {
          morphologyType = 'Hebrew';
        } else if (lang === 'el' || lang === 'grc' || lang === 'gre') {
          morphologyType = 'Greek';
        }

        const morphInfo = (morph == null || morphologyType === '')
          ? ''
          : morphology[morphologyType].format(morph);

        if (morphInfo != null && morphInfo !== '') {
          lemmaInfo.innerHTML = morphInfo;
          lemmaInfo.style.display = '';
          lemmaInfo.style.left = `${mainOffset.left + 15}px`;
          lemmaInfo.style.top = `${mainOffset.top + main.offsetHeight - lemmaInfo.offsetHeight - 10}px`;
        }
      });

      on(windowsMain, 'mouseout', 'l', function(e) {
        lemmaInfo.style.display = 'none';
      });
    }
  }

  return {};
};

export default LemmaInfoPlugin;
