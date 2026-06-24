import { getConfig } from '../core/config.js';
import { Reference } from '../bible/BibleReference.js';
import { TextNavigation } from '../common/TextNavigation.js';
import { elem } from '../lib/helpers.esm.js';
import arrowRightSvg from '../../css/images/arrow-right-gray-light.svg?raw';
import arrowLeftSvg from '../../css/images/arrow-left-gray-light.svg?raw';

export function NavigationButtons(parentNode) {
  const config = getConfig();
  if (!config.enableNavigationButtons) return null;

  const backButton = elem('div', { id: 'main-back-button', className: 'inactive', innerHTML: arrowLeftSvg });
  const forwardButton = elem('div', { id: 'main-forward-button', className: 'inactive', innerHTML: arrowRightSvg });

  const compactLabel = elem('span', { id: 'compact-back-button-label' });
  const compactBackButton = elem('div', { id: 'compact-back-button' },
    elem('span', { className: 'compact-back-icon', innerHTML: arrowLeftSvg }),
    compactLabel
  );

  parentNode.appendChild(backButton);
  parentNode.appendChild(forwardButton);
  document.body.appendChild(compactBackButton);

  const back = () => TextNavigation.back();

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

    forwardButton.classList.toggle('inactive', locationIndex >= locations.length - 1);
  };

  forwardButton.addEventListener('click', () => TextNavigation.forward());
  backButton.addEventListener('click', back);
  compactBackButton.addEventListener('click', back);

  TextNavigation.on('locationchange', updateButtonStates);

  updateButtonStates();
}
