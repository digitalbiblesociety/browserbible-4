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
      const aboutDoc = new DOMParser().parseFromString(aboutHtml, 'text/html');
      const aboutContent = elem('div', { className: 'about-screen' });
      aboutContent.append(...aboutDoc.body.children);
      aboutWindow.body.appendChild(aboutContent);

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