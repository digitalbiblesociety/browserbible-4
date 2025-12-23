/**
 * DeafBibleWindow - Web Component for Deaf Bible content with video switching
 */

import { TextWindowComponent, registerWindowComponent } from './TextWindow.js';
import { on, closest, siblings, toElement } from '../lib/helpers.esm.js';
import { updateConfig } from '../core/config.js';

updateConfig({
  enableDeafBibleWindow: true,
  deafBibleWindowDefaultBibleFragmentid: 'JN1_1',
  deafBibleWindowDefaultBibleVersion: 'deaf_ASESLV'
});

/**
 * DeafBibleWindow Web Component
 * Extends TextWindow with video switching functionality
 */
export class DeafBibleWindow extends TextWindowComponent {
  constructor() {
    super();
    this.state.textType = 'deafbible';
  }

  attachEventListeners() {
    super.attachEventListeners();

    on(this, 'click', '.deaf-video-header input', function() {
      const button = this;
      const url = button.getAttribute('data-src');
      const video = closest(button, '.deaf-video')?.querySelector('video');

      button.classList.add('active');
      siblings(button).forEach(sib => {
        sib.classList.remove('active');
      });

      if (video) {
        video.setAttribute('src', url);
      }
    });
  }
}

registerWindowComponent('deaf-bible-window', DeafBibleWindow, {
  windowType: 'deafbible',
  displayName: 'Deaf Bible',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

export default DeafBibleWindow;
