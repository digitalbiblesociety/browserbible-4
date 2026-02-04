/**
 * AudioWindow - Web Component for standalone audio player with navigation
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { Reference } from '../bible/BibleReference.js';
import { AudioController } from './AudioController.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { getGlobalTextNavigator } from '../ui/TextNavigator.js';
import { getText } from '../texts/TextLoader.js';

const hasTouch = 'ontouchend' in document;

const getTextAsync = (textId) => AsyncHelpers.promisify(getText, textId);

/**
 * AudioWindow Web Component
 * Standalone audio player with navigation controls
 */
export class AudioWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      currentTextInfo: null,
      currentLocationInfo: null,
      textType: 'audio'
    };

    this.audioController = null;
    this.scrollerMimic = null;
    this.textChooser = getGlobalTextChooser();
    this.textNavigator = getGlobalTextNavigator();
  }

  async render() {
    this.innerHTML = `
      <div class="audio-window-container">
        <div class="window-header audio-window-header">
          <div class="audio-window-header-inner">
            <input type="text" class="app-input text-nav" />
            <div class="app-list text-list"></div>
          </div>
        </div>
        <div class="audio-window-main"></div>
        <div class="audio-window-error" style="display: none;">
          <div class="audio-error-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h6"></path>
              <rect x="4" y="4" width="16" height="16" rx="2"></rect>
            </svg>
          </div>
          <div class="audio-error-title">No Audio Available</div>
          <div class="audio-error-message">This Bible version doesn't have audio recordings. Please select a different version with audio support.</div>
        </div>
        <div class="audio-window-version-info"></div>
      </div>
    `;
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.container = this.$('.audio-window-container');
    this.refs.header = this.$('.audio-window-header');
    this.refs.main = this.$('.audio-window-main');
    this.refs.errorPanel = this.$('.audio-window-error');
    this.refs.navui = this.$('.text-nav');
    this.refs.textlistui = this.$('.text-list');
  }

  attachEventListeners() {
    // Navigator click
    this.addListener(this.refs.navui, 'click', (e) => this.handleNavClick(e));

    // Navigator Enter key
    this.addListener(this.refs.navui, 'keypress', (e) => this.handleNavKeypress(e));

    // Text chooser click
    this.addListener(this.refs.textlistui, 'click', () => this.handleTextListClick());

    // Text navigator change - use bound handlers for global singletons
    this._textNavigatorHandler = this.bindHandler('textNavigatorChange', (e) => this.handleTextNavigatorChange(e));
    this.textNavigator.on('change', this._textNavigatorHandler);

    // Text chooser change - use bound handlers for global singletons
    this._textChooserHandler = this.bindHandler('textChooserChange', (e) => this.handleTextChooserChange(e));
    this.textChooser.on('change', this._textChooserHandler);

    // Message handling
    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    this.refs.navui.innerHTML = 'Reference';
    this.refs.navui.value = 'Reference';
    this.refs.textlistui.innerHTML = 'Version';

    this.scrollerMimic = {};
    mixinEventEmitter(this.scrollerMimic);
    this.scrollerMimic.getLocationInfo = () => this.state.currentLocationInfo;

    this.audioController = AudioController(this.windowId, this.refs.main, null, this.scrollerMimic);

    this.audioController.on('audioavailable', (e) => {
      const hasAudio = e.data.hasAudio;
      if (hasAudio) {
        this.refs.errorPanel.style.display = 'none';
        this.refs.main.style.display = '';
      } else {
        this.refs.errorPanel.style.display = '';
        this.refs.main.style.display = 'none';
      }
    });

    await this.loadInitialText();
  }

  cleanup() {
    if (this._textNavigatorHandler) {
      this.textNavigator.off('change', this._textNavigatorHandler);
    }
    if (this._textChooserHandler) {
      this.textChooser.off('change', this._textChooserHandler);
    }

    super.cleanup();
    this.textChooser.hide();
    this.textNavigator.hide();

    if (this.audioController?.close) {
      this.audioController.close();
    }

    if (this.scrollerMimic?.clearListeners) {
      this.scrollerMimic.clearListeners();
    }
  }

  handleNavClick(e) {
    if (hasTouch) {
      this.refs.navui.blur();
    }

    if (this.textNavigator.getTarget() === this.refs.navui) {
      this.textNavigator.toggle();
    } else {
      this.textNavigator.setTarget(this.refs.container, this.refs.navui);
      this.textNavigator.setTextInfo(this.state.currentTextInfo);
      this.textNavigator.show();
    }
  }

  handleNavKeypress(e) {
    if (e.keyCode === 13 || e.key === 'Enter') {
      const userinput = this.refs.navui.value;
      const bibleref = new Reference(userinput);
      const fragmentid = bibleref.toSection?.() ?? '';
      const sectionid = fragmentid.split('_')[0];

      if (sectionid !== '') {
        this.changeLocation(fragmentid);
      }
    }
  }

  handleTextListClick() {
    if (this.textChooser.getTarget() === this.refs.textlistui) {
      this.textChooser.toggle();
    } else {
      this.textChooser.setTarget(this.refs.container, this.refs.textlistui, this.state.textType);
      this.textChooser.setTextInfo(this.state.currentTextInfo);
      this.textChooser.show();
    }
  }

  handleTextNavigatorChange(e) {
    const target = e.data.target?.nodeType ? e.data.target : e.data.target?.[0];
    if (target !== this.refs.navui) return;
    this.changeLocation(e.data.sectionid);
  }

  handleTextChooserChange(e) {
    const target = e.data.target?.nodeType ? e.data.target : e.data.target?.[0];
    if (target !== this.refs.textlistui) return;
    const newTextInfo = e.data.textInfo;
    this.updateText(newTextInfo);
  }

  handleMessage(e) {
  }

  changeLocation(inputLocation) {
    const bibleref = new Reference(inputLocation);
    const fragmentid = bibleref.toSection?.() ?? '';
    const sectionid = fragmentid.split('_')[0];

    const newLocationInfo = {
      fragmentid,
      sectionid
    };

    this.state.currentLocationInfo = newLocationInfo;

    this.scrollerMimic?.trigger?.('locationchange', {
      type: 'locationchange',
      target: this,
      data: newLocationInfo
    });

    this.trigger('settingschange', {
      type: 'settingschange',
      target: this,
      data: this.getData()
    });

    this.textNavigator?.hide();

    this.refs.navui.value = bibleref.toString();
    this.refs.navui.blur();
  }

  updateText(newTextInfo) {
    this.refs.textlistui.innerHTML = newTextInfo.abbr;
    this.updateTabLabel(newTextInfo.abbr);
    this.textNavigator?.setTextInfo(newTextInfo);
    this.audioController?.setTextInfo?.(newTextInfo);

    this.state.currentTextInfo = newTextInfo;
  }

  async loadInitialText() {
    const initData = this.initData || {};

    if (!initData || Object.keys(initData).length === 0) {
      return;
    }

    if (initData.fragmentid && initData.fragmentid !== '') {
      this.changeLocation(initData.fragmentid);
    }

    let textid = initData.textid;
    if (!textid || textid === '') {
      textid = this.config.newBibleWindowVersion;
    }

    try {
      const loadedTextInfo = await getTextAsync(textid);
      this.state.currentTextInfo = loadedTextInfo;
      this.updateText(loadedTextInfo);
    } catch (err) {
      console.error('Error loading text:', textid, err);
    }
  }

  size(width, height) {
    this.refs.container.style.width = `${width}px`;
    this.refs.container.style.height = `${height}px`;
  }

  getData() {
    let currentTextInfo = this.state.currentTextInfo;
    let currentLocationInfo = this.state.currentLocationInfo;

    if (currentTextInfo == null) {
      currentTextInfo = this.textChooser.getTextInfo();
    }
    if (currentLocationInfo == null) {
      currentLocationInfo = this.scrollerMimic?.getLocationInfo();
    }

    if (currentTextInfo == null || currentLocationInfo == null) {
      return null;
    }

    return {
      textid: currentTextInfo.providerid,
      abbr: currentTextInfo.abbr,
      sectionid: currentLocationInfo.sectionid,
      fragmentid: currentLocationInfo.fragmentid,
      label: currentLocationInfo.label,
      labelTab: currentTextInfo.abbr,
      labelLong: currentLocationInfo.labelLong,
      params: {
        win: 'audio',
        textid: currentTextInfo.providerid,
        fragmentid: currentLocationInfo.fragmentid
      }
    };
  }
}

registerWindowComponent('audio-window', AudioWindowComponent, {
  windowType: 'audio',
  displayName: 'Audio',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

export { AudioWindowComponent as AudioWindow };

export default AudioWindowComponent;
