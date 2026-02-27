/**
 * DeafBibleWindow - Web Component for Deaf Bible content with video switching
 */

import { TextWindowComponent, registerWindowComponent } from './TextWindow.js';

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

    this.addEventListener('click', (e) => {
      const button = e.target.closest('.deaf-video-header input');
      if (button) {
        const url = button.getAttribute('data-src');
        const video = button.closest('.deaf-video')?.querySelector('video');

        button.classList.add('active');
        [...button.parentElement.children].filter(s => s !== button).forEach(sib => {
          sib.classList.remove('active');
        });

        if (video) {
          video.setAttribute('src', url);
        }
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
