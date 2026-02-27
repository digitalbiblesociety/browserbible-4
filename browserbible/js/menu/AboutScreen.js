import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import { elem } from '../lib/helpers.esm.js';
import { getWindowIcon } from '../core/windowIcons.js';

const WINDOW_SIZE = { widthRatio: 0.8, heightRatio: 0.7 };

const aboutHtml = `
<h1>Browser Bible</h1>
<p>Bible study application with Greek and Hebrew.</p>
<p>Developed by <a href="http://www.digitalbiblesociety.com/">Digital Bible Society</a> with major contributions from <a href="http://j.hn/">John Dyer</a> and <a href="http://ebible.org/">Michael Johnson</a>. Audio provided by <a href="https://www.faithcomesbyhearing.com/">Faith Comes by Hearing</a> and video by <a href="http://www.jesusfilm.org/">Jesus Film Project</a>.</p>
<p>Source code: <a href="https://github.com/digitalbiblesociety/browserbible-3">Download from Github</a></p>
`;

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

      aboutBody.style.padding = '20px';
      aboutBody.innerHTML = aboutHtml;
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
