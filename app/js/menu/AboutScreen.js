/**
 * AboutScreen
 * About dialog with HTML content loading
 * Uses native popover API for click-off detection
 */

import { createElements, qs } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';

/**
 * Create about button and dialog
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement} Button element
 */
export function AboutScreen(_parentNode, _menu) {
  const config = getConfig();
  const container = qs('.windows-container');
  const aboutButton = createElements('<div class="main-menu-item about-logo i18n" data-i18n="[html]menu.labels.about">About</div>');
  const mainMenuFeatures = qs('#main-menu-features');
  const aboutWindow = new MovableWindow(500, 250, i18n.t('menu.labels.about'));

  let isAboutLoaded = false;

  if (mainMenuFeatures) {
    mainMenuFeatures.appendChild(aboutButton);
  }

  // Handle popover toggle events (fires on light dismiss - click outside or Escape)
  aboutWindow.onToggle((e) => {
    if (e.newState === 'closed') {
      container?.classList.remove('blur');
    } else {
      container?.classList.add('blur');
    }
  });

  // aboutWindow.body
  const aboutBody = aboutWindow.body[0] ?? aboutWindow.body;
  aboutBody.style.padding = '20px';

  const aboutTitle = aboutWindow.title[0] ?? aboutWindow.title;
  aboutTitle.classList.add('i18n');
  aboutTitle.setAttribute('data-i18n', '[html]menu.labels.about');

  const showAboutContent = (data, url) => {
    if (data.indexOf('<html') > -1) {
      aboutBody.innerHTML = `<iframe style="border: 0;" src="${url}"></iframe>`;
      aboutBody.style.padding = '2px';

      const iframe = aboutBody.querySelector('iframe');

      if (iframe) {
        iframe.style.width = `${aboutBody.offsetWidth}px`;
        iframe.style.height = `${aboutBody.offsetHeight - 5}px`;
      }
    } else {
      aboutBody.innerHTML = data;
    }
  };

  const aboutClick = () => {
    if (aboutWindow.isVisible()) {
      aboutWindow.hide();
    } else {
      // Properly close the main menu popover
      const mainMenuDropdown = qs('#main-menu-dropdown');
      if (mainMenuDropdown?.matches(':popover-open')) {
        mainMenuDropdown.hidePopover();
      }

      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      aboutWindow
        .size(0.8 * winWidth, 0.7 * winHeight)
        .show()
        .center();

      if (!isAboutLoaded) {
        aboutBody.classList.add('loading-indicator');

        // assume a local file first
        fetch(config.aboutPagePath)
          .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
          })
          .then(data => {
            aboutBody.classList.remove('loading-indicator');
            isAboutLoaded = true;
            showAboutContent(data, config.aboutPagePath);
          })
          .catch(() => {
            if (config.baseContentUrl !== '') {
              // this one will go through the CDN
              fetch(config.baseContentUrl + config.aboutPagePath)
                .then(response => {
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  return response.text();
                })
                .then(data => {
                  aboutBody.classList.remove('loading-indicator');
                  isAboutLoaded = true;
                  showAboutContent(data, config.baseContentUrl + config.aboutPagePath);
                })
                .catch(() => {
                  console.log("Can't find about.html");
                });
            } else {
              console.log('No local about.html, no CDN to check');
            }
          });
      }
    }
  };

  aboutButton.addEventListener('click', aboutClick, false);

  return aboutButton;
}

export default AboutScreen;
