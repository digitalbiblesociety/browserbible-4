import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import { elem } from '../lib/helpers.esm.js';
import { getWindowIcon } from '../core/windowIcons.js';
import aboutHtml from '../../about.html?raw';

export function AboutScreen() {
  const aboutButton = elem('div', { className: 'main-menu-item' },
    elem('span', { className: 'main-menu-icon', innerHTML: getWindowIcon('about') || '' }),
    elem('span', { className: 'i18n', dataset: { i18n: '[html]menu.labels.about' } })
  );
  document.querySelector('#main-menu-features')?.appendChild(aboutButton);

  let aboutWindow = null;
  const getWindow = () => {
    if (!aboutWindow) {
      aboutWindow = new MovableWindow(500, 250, i18n.t('menu.labels.about'));
      aboutWindow.body.appendChild(elem('iframe', {
        className: 'about-frame',
        title: i18n.t('menu.labels.about'),
        srcdoc: aboutHtml,
        style: { width: '100%', height: '100%', border: '0', display: 'block' }
      }));

      const aboutTitle = aboutWindow.title;
      aboutTitle.classList.add('i18n');
      aboutTitle.dataset.i18n = '[html]menu.labels.about';
    }
    return aboutWindow;
  };

  aboutButton.addEventListener('click', () => {
    const win = getWindow();
    if (win.isVisible()) {
      win.hide();
      return;
    }
    document.querySelector('#main-menu-dropdown[popover]')?.hidePopover();
    win
      .size(.8 * innerWidth, innerHeight)
      .show();
  });

  return aboutButton;
}