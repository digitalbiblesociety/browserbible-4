// DeafBibleWindow - TextWindow chrome with a DeafVideoPlayer in place of the text pane.

import { TextWindowComponent, registerWindowComponent } from './TextWindow.js';
import { DeafVideoPlayer } from './DeafVideoPlayer.js';

export class DeafBibleWindow extends TextWindowComponent {
  constructor() {
    super();
    this.state.textType = 'deafbible';
  }

  createScroller() {
    return DeafVideoPlayer(this.refs.main);
  }

  createAudioController() {
    if (this.refs.audioui) this.refs.audioui.style.display = 'none';
    return null;
  }
}

registerWindowComponent('deaf-bible-window', DeafBibleWindow, {
  windowType: 'deafbible',
  displayName: 'Deaf Bible',
  paramKeys: { textid: 't', fragmentid: 'v' }
});
