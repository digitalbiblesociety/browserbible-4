import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import { elem } from '../lib/helpers.esm.js';
import { getWindowIcon } from '../core/windowIcons.js';
import aboutHtml from '../../about.html?raw';

const WINDOW_SIZE = { widthRatio: 0.8, heightRatio: 0.7 };

export function AboutScreen() {
  const aboutButton = elem('div', { className: 'main-menu-item' });
  const aboutIconSpan = elem('span', { className: 'main-menu-icon' });
  aboutIconSpan.innerHTML = getWindowIcon('about') || '';
  aboutButton.appendChild(aboutIconSpan);
  const aboutTextSpan = elem('span', { className: 'i18n' });
  aboutTextSpan.dataset.i18n = '[html]menu.labels.about';
  aboutButton.appendChild(aboutTextSpan);

  document.querySelector('#main-menu-features')?.appendChild(aboutButton);

  let aboutWindow = null;

  const getWindow = () => {
    if (!aboutWindow) {
      aboutWindow = new MovableWindow(500, 250, i18n.t('menu.labels.about'));
      const aboutBody = [aboutWindow.body].flat()[0];
      const aboutTitle = [aboutWindow.title].flat()[0];
      aboutBody.style.padding = '0';
      const aboutFrame = elem('iframe', { className: 'about-frame', title: i18n.t('menu.labels.about') });
      aboutFrame.setAttribute('srcdoc', aboutHtml);
      aboutFrame.style.cssText = 'width:100%;height:100%;border:0;display:block;';
      aboutBody.appendChild(aboutFrame);

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
      .size(WINDOW_SIZE.widthRatio * innerWidth, WINDOW_SIZE.heightRatio * innerHeight)
      .show();
  });

  return aboutButton;
}

export default AboutScreen;
