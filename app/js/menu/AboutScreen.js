import { getConfig } from '../core/config.js';
import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';

const WINDOW_SIZE = { widthRatio: 0.8, heightRatio: 0.7 };

async function fetchAboutContent(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { data: await response.text(), url };
}

export function AboutScreen() {
  const config = getConfig();
  const aboutButton = Object.assign(document.createElement('div'), {
    className: 'main-menu-item about-logo i18n',
    textContent: 'About'
  });
  aboutButton.dataset.i18n = '[html]menu.labels.about';

  document.querySelector('#main-menu-features')?.appendChild(aboutButton);

  let aboutWindow = null;
  let aboutBody = null;
  let isLoaded = false;

  const getWindow = () => {
    if (!aboutWindow) {
      aboutWindow = new MovableWindow(500, 250, i18n.t('menu.labels.about'));
      aboutBody = [aboutWindow.body].flat()[0];
      const aboutTitle = [aboutWindow.title].flat()[0];

      aboutBody.style.padding = '20px';
      aboutTitle.classList.add('i18n');
      aboutTitle.dataset.i18n = '[html]menu.labels.about';
    }
    return aboutWindow;
  };

  const showContent = (data, url) => {
    if (data.includes('<html')) {
      aboutBody.innerHTML = `<iframe style="border:0; width:${aboutBody.offsetWidth}px; height:${aboutBody.offsetHeight - 5}px" src="${url}"></iframe>`;
      aboutBody.style.padding = '2px';
    } else {
      aboutBody.innerHTML = data;
    }
  };

  const loadContent = async () => {
    aboutBody.classList.add('loading-indicator');

    const urls = [config.aboutPagePath];
    if (config.baseContentUrl) {
      urls.push(config.baseContentUrl + config.aboutPagePath);
    }

    for (const url of urls) {
      try {
        const { data } = await fetchAboutContent(url);
        aboutBody.classList.remove('loading-indicator');
        isLoaded = true;
        showContent(data, url);
        return;
      } catch {
        // Try next URL
      }
    }

    aboutBody.classList.remove('loading-indicator');
    console.log("Can't find about.html");
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
      .show()
      .center();

    if (!isLoaded) loadContent();
  });

  return aboutButton;
}

export default AboutScreen;
