/**
 * LemmaInfoPlugin
 * Shows morphology info on hover over lemma elements
 */

import { offset } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
const hasTouch = 'ontouchend' in document;
import { morphology } from '../bible/Morphology.js';

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

  const lemmaInfo = Object.assign(document.createElement('div'), { className: 'lemma-info' });
  document.body.appendChild(lemmaInfo);
  lemmaInfo.style.display = 'none';

  if (!hasTouch) {
    const windowsMain = document.querySelector('.windows-main');

    if (windowsMain) {
      windowsMain.addEventListener('mouseover', (e) => {
        const l = e.target.closest('.BibleWindow l');
        if (!l) return;
        const morph = l.getAttribute('m');
        const main = l.closest('.scroller-main');
        const mainOffset = main ? offset(main) : { left: 0, top: 0 };
        const section = l.closest('.section');
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

      windowsMain.addEventListener('mouseout', (e) => {
        const target = e.target.closest('l');
        if (target) {
          lemmaInfo.style.display = 'none';
        }
      });
    }
  }

  return {};
};

export default LemmaInfoPlugin;
