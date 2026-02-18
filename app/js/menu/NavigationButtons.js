/**
 * NavigationButtons
 * Forward/back navigation buttons
 */

import { getConfig } from '../core/config.js';
import { Reference } from '../bible/BibleReference.js';
import { TextNavigation } from '../common/TextNavigation.js';
import arrowRightSvg from '../../css/images/arrow-right-gray-light.svg?raw';
import arrowLeftSvg from '../../css/images/arrow-left-gray-light.svg?raw';

export function NavigationButtons() {
  const config = getConfig();
  if (!config.enableNavigationButtons) return null;

  const d = document;
  const windowsHeader = d.querySelector('.windows-header');
  if (!windowsHeader) return null;

  const forwardButton = d.createElement('div');
  forwardButton.id = 'main-forward-button';
  forwardButton.className = 'inactive';
  forwardButton.innerHTML = arrowRightSvg;

  const backButton = d.createElement('div');
  backButton.id = 'main-back-button';
  backButton.className = 'inactive';
  backButton.innerHTML = arrowLeftSvg;

  const compactBackButton = d.createElement('div');
  compactBackButton.id = 'compact-back-button';

  const compactBackIcon = d.createElement('span');
  compactBackIcon.className = 'compact-back-icon';
  compactBackIcon.innerHTML = arrowLeftSvg;
  compactBackButton.appendChild(compactBackIcon);

  const compactLabel = d.createElement('span');
  compactLabel.id = 'compact-back-button-label';
  compactBackButton.appendChild(compactLabel);

  windowsHeader.appendChild(forwardButton);
  windowsHeader.appendChild(backButton);
  d.body.appendChild(compactBackButton);

  const back = () => TextNavigation.back();
  const forward = () => TextNavigation.forward();

  const updateButtonStates = () => {
    const locations = TextNavigation.getLocations();
    const locationIndex = TextNavigation.getLocationIndex();

    if (locationIndex > 0) {
      backButton.classList.remove('inactive');

      const lastRef = new Reference(locations[locations.length - 2]);
      compactLabel.innerHTML = lastRef.toString();

      compactBackButton.classList.add('active');
    } else {
      backButton.classList.add('inactive');
      compactBackButton.classList.remove('active');
    }

    if (locationIndex < locations.length - 1) {
      forwardButton.classList.remove('inactive');
    } else {
      forwardButton.classList.add('inactive');
    }
  };

  forwardButton.addEventListener('click', forward);
  backButton.addEventListener('click', back);
  compactBackButton.addEventListener('click', back);

  TextNavigation.on('locationchange', () => updateButtonStates());

  updateButtonStates();
}

export default NavigationButtons;
