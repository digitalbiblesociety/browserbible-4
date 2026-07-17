/**
 * LemmaInfoPlugin
 * Shows morphology info on hover over lemma elements
 */

import { offset, elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { morphology } from '../bible/Morphology.js';

export const LemmaInfoPlugin = () => {
  if (!getConfig().enableLemmaInfoPlugin) return {};

  const windowsMain = document.querySelector('.windows-main');
  if (('ontouchend' in document) || !windowsMain) return {};

  const lemmaInfo = elem('div', { className: 'lemma-info', style: { display: 'none' } });
  document.body.appendChild(lemmaInfo);

  windowsMain.addEventListener('mouseover', (e) => {
    const l = e.target.closest('.BibleWindow l');
    if (!l) return;
    const main = l.closest('.scroller-main');
    if (!main) return;
    const morph = l.getAttribute('m');
    const mainOffset = offset(main);
    const section = l.closest('.section');
    const lang = section?.getAttribute('lang') ?? '';

    let morphologyType = '';
    if (lang === 'heb' || lang === 'he') {
      morphologyType = 'Hebrew';
    } else if (lang === 'el' || lang === 'grc' || lang === 'gre') {
      morphologyType = 'Greek';
    }

    const morphInfo = (morph == null || morphologyType === '') ? '' : morphology[morphologyType].format(morph);
    if (morphInfo != null && morphInfo !== '') {
      lemmaInfo.innerHTML = morphInfo;
      lemmaInfo.style.display = '';
      lemmaInfo.style.left = `${mainOffset.left + 15}px`;
      lemmaInfo.style.top = `${mainOffset.top + main.offsetHeight - lemmaInfo.offsetHeight - 10}px`;
    }
  });

  windowsMain.addEventListener('mouseout', (e) => {
    if (e.target.closest('l')) {
      lemmaInfo.style.display = 'none';
    }
  });

  return {};
};
