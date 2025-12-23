/**
 * NavigationButtons
 * Forward/back navigation buttons
 */

import { createElements, fadeOut, qs } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import { Reference } from '../bible/BibleReference.js';
import { TextNavigation } from '../common/Navigation.js';

// Default config
updateConfig({
  enableNavigationButtons: true
});

/**
 * Create navigation buttons
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {null}
 */
export function NavigationButtons(_parentNode, _menu) {
  const config = getConfig();

  if (!config.enableNavigationButtons) {
    return null;
  }

  document.documentElement.classList.add('supports-fullscreen');

  const windowsHeader = qs('.windows-header');

  const forwardButton = createElements('<div id="main-forward-button" class="inactive"></div>');
  const backButton = createElements('<div id="main-back-button" class="inactive"></div>');
  const compactBackButton = createElements('<div id="compact-back-button"><span id="compact-back-button-label"></span></div>');

  if (windowsHeader) {
    windowsHeader.appendChild(forwardButton);
    windowsHeader.appendChild(backButton);
  }
  document.body.appendChild(compactBackButton);

  // Define arrow functions before usage
  const back = () => {
    TextNavigation.back();
  };

  const forward = () => {
    TextNavigation.forward();
  };

  let compactTimer = null;

  const hideCompactTimer = () => {
    if (compactBackButton.style.display !== 'none') {
      fadeOut(compactBackButton);
    }
  };

  const clearCompactTimer = () => {
    if (compactTimer !== null) {
      clearTimeout(compactTimer);
    }
  };

  const startCompactTimer = () => {
    clearCompactTimer();
    compactTimer = setTimeout(hideCompactTimer, 5000);
  };

  const updateButtonStates = () => {
    const locations = TextNavigation.getLocations();
    const locationIndex = TextNavigation.getLocationIndex();

    // BACK
    if (locationIndex > 0) {
      backButton.classList.remove('inactive');

      // setup mobile/compact button
      const lastRef = new Reference(locations[locations.length - 2]);
      const label = compactBackButton.querySelector('#compact-back-button-label');
      if (label) label.innerHTML = lastRef.toString();

      compactBackButton.classList.add('active');
      compactBackButton.style.display = '';

      if (document.body.classList.contains('compact-ui')) {
        startCompactTimer();
      }
    } else {
      backButton.classList.add('inactive');
      compactBackButton.classList.remove('active');
    }

    // FORWARD
    if (locationIndex < locations.length - 1) {
      forwardButton.classList.remove('inactive');
    } else {
      forwardButton.classList.add('inactive');
    }
  };

  forwardButton.addEventListener('click', forward, false);
  backButton.addEventListener('click', back, false);
  compactBackButton.addEventListener('click', back, false);

  // Listen for location changes
  TextNavigation.on('locationchange', (_e) => {
    updateButtonStates();
  });

  updateButtonStates();

  return null;
}

export default NavigationButtons;
