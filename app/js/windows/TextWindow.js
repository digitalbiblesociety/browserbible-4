/**
 * TextWindow - Web Component for displaying Bible/Commentary text
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { Scroller } from './Scroller.js';
import { AudioController } from './AudioController.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { getGlobalTextNavigator } from '../ui/TextNavigator.js';
import { getText, loadTexts } from '../texts/TextLoader.js';
import { TextNavigation } from '../common/TextNavigation.js';
import infoSvg from '../../css/images/info.svg?raw';
import audioEarSvg from '../../css/images/audio-ear.svg?raw';

export { registerWindowComponent } from './BaseWindow.js';

const hasTouch = 'ontouchend' in document;

const getTextAsync = (textId) => AsyncHelpers.promisify(getText, textId);
const loadTextsAsync = () => AsyncHelpers.promisify(loadTexts);

/**
 * TextWindow Web Component
 * Base component for Bible and Commentary windows
 */
export class TextWindowComponent extends BaseWindow {
  constructor() {
    super();

    // Extend state
    this.state = {
      ...this.state,
      currentTextInfo: null,
      currentLocationInfo: null,
      hasFocus: false,
      textType: 'bible' // Default, can be overridden
    };

    this.scroller = null;
    this.audioController = null;
    this.textChooser = getGlobalTextChooser();
    this.textNavigator = getGlobalTextNavigator();
  }

  async render() {
    const parentNodeHeight = this.parentElement?.offsetHeight || 600;

    this.innerHTML = `
      <div class="scroller-container">
        <div class="window-header scroller-header">
          <div class="scroller-header-inner">
            <input type="text" class="app-input text-nav" />
            <div class="app-list text-list"></div>
            <span class="header-icon info-button"></span>
            <span class="header-icon audio-button"></span>
          </div>
        </div>
        <div class="scroller-main">
          <div class="scroller-text-wrapper reading-text">
            <div class="loading-indicator" style="height:${parentNodeHeight}px;"></div>
          </div>
        </div>
        <div class="scroller-info" popover>
          <div class="scroller-info-header">
            <h2 class="scroller-info-title">Version Information</h2>
            <button class="scroller-info-close" type="button">&times;</button>
          </div>
          <div class="scroller-info-content"></div>
        </div>
      </div>
    `;

    this.querySelector('.info-button').innerHTML = infoSvg;
    this.querySelector('.audio-button').innerHTML = audioEarSvg;
  }

  cacheRefs() {
    super.cacheRefs();
    const container = this.$('.scroller-container');

    this.refs.container = container;
    this.refs.header = this.$('.scroller-header');
    this.refs.main = this.$('.scroller-main');
    this.refs.wrapper = this.$('.scroller-text-wrapper');
    this.refs.info = this.$('.scroller-info');
    this.refs.infoTitle = this.$('.scroller-info-title');
    this.refs.infoContent = this.$('.scroller-info-content');
    this.refs.infoCloseBtn = this.$('.scroller-info-close');
    this.refs.infoBtn = this.$('.info-button');
    this.refs.navui = this.$('.text-nav');
    this.refs.textlistui = this.$('.text-list');
    this.refs.audioui = this.$('.audio-button');
  }

  attachEventListeners() {
    // Info popover close button
    this.addListener(this.refs.infoCloseBtn, 'click', () => this.handleInfoClose());

    // Info button - toggle popover
    this.addListener(this.refs.infoBtn, 'click', () => this.handleInfoToggle());

    // Text chooser button
    this.addListener(this.refs.textlistui, 'click', () => this.handleTextListClick());

    // Navigator button
    this.addListener(this.refs.navui, 'click', (e) => this.handleNavClick(e));

    // Navigator Enter key
    this.addListener(this.refs.navui, 'keydown', (e) => this.handleNavKeydown(e));

    // Text chooser change - use bound handlers for global singletons
    this._textChooserHandler = this.bindHandler('textChooserChange', (e) => this.handleTextChooserChange(e));
    this.textChooser.on('change', this._textChooserHandler);

    // Text navigator change - use bound handlers for global singletons
    this._textNavigatorHandler = this.bindHandler('textNavigatorChange', (e) => this.handleTextNavigatorChange(e));
    this.textNavigator.on('change', this._textNavigatorHandler);

    // Focus/blur
    this.on('focus', () => { this.state.hasFocus = true; });
    this.on('blur', () => { this.state.hasFocus = false; });

    // Message handling
    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    // Get text type from init data or attribute (preserve constructor default)
    this.state.textType = this.getParam('textType', this.state.textType || 'bible');

    // Initialize UI
    this.refs.navui.innerHTML = 'Reference';
    this.refs.navui.value = 'Reference';
    this.refs.textlistui.innerHTML = 'Version';

    // Create scroller and audio controller
    this.scroller = Scroller(this.refs.main);
    this.audioController = AudioController(this.windowId, this.refs.container, this.refs.audioui, this.scroller);

    // Set up scroller event handlers
    this.scroller.on('scroll', () => this.updateTextnav());
    this.scroller.on('locationchange', () => this.updateTextnav());
    this.scroller.on('load', () => this.updateTextnav());
    this.scroller.on('globalmessage', (e) => {
      if ((e.data.messagetype === 'nav' && this.state.hasFocus) || e.data.messagetype !== 'nav') {
        this.trigger('globalmessage', { type: e.type, target: this, data: e.data });
      }
    });

    // Load initial text
    await this.loadInitialText();
  }

  cleanup() {
    if (this._textChooserHandler) {
      this.textChooser.off('change', this._textChooserHandler);
    }
    if (this._textNavigatorHandler) {
      this.textNavigator.off('change', this._textNavigatorHandler);
    }

    super.cleanup();

    this.textChooser.hide();
    this.textNavigator.hide();

    if (this.scroller?.close) this.scroller.close();
    if (this.audioController?.close) this.audioController.close();
  }

  handleInfoClose() {
    this.refs.info.hidePopover();
  }

  async handleInfoToggle() {
    this.textChooser.hide();
    this.textNavigator.hide();

    if (this.refs.info.matches(':popover-open')) {
      this.refs.info.hidePopover();
      return;
    }

    // Update title with current version name
    if (this.state.currentTextInfo) {
      this.refs.infoTitle.textContent = `${this.state.currentTextInfo.name || this.state.currentTextInfo.abbr} Information`;
    }

    if (this.state.currentTextInfo?.aboutHtml !== undefined) {
      this.refs.infoContent.innerHTML = this.state.currentTextInfo.aboutHtml;
    } else {
      this.refs.infoContent.innerHTML = '<div class="loading-indicator">Loading information...</div>';

      try {
        const response = await fetch(`${this.config.baseContentUrl}${this.config.textsPath}/${this.state.currentTextInfo.id}/about.html`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const htmlString = await response.text();
        const breakTag = '<body';
        const fixedHtml = htmlString.indexOf(breakTag) > -1
          ? breakTag + htmlString.split(breakTag)[1]
          : '';

        this.refs.infoContent.innerHTML = fixedHtml;
        this.state.currentTextInfo.aboutHtml = fixedHtml;
      } catch (err) {
        this.refs.infoContent.innerHTML = `
          <div class="scroller-info-empty">
            <p>No additional information is available for this version.</p>
            <p class="scroller-info-version-name">${this.state.currentTextInfo?.name || this.state.currentTextInfo?.abbr || 'Current Version'}</p>
          </div>
        `;
      }
    }

    // Position the info panel to fill this window (popover is in top layer)
    const rect = this.refs.container.getBoundingClientRect();
    this.refs.info.style.top = `${rect.top}px`;
    this.refs.info.style.left = `${rect.left}px`;
    this.refs.info.style.width = `${rect.width}px`;
    this.refs.info.style.height = `${rect.height}px`;

    this.refs.info.showPopover();
  }

  handleTextListClick() {
    if (this.refs.info.matches(':popover-open')) {
      this.refs.info.hidePopover();
    }

    if (this.textChooser.getTarget() === this.refs.textlistui) {
      this.textChooser.toggle();
    } else {
      this.textChooser.setTarget(this.refs.container, this.refs.textlistui, this.state.textType);
      this.textChooser.setTextInfo(this.state.currentTextInfo);
      this.textChooser.show();
    }
  }

  handleNavClick(e) {
    if (hasTouch) {
      this.refs.navui.blur();
    }

    if (this.refs.info.matches(':popover-open')) {
      this.refs.info.hidePopover();
    }

    if (this.textNavigator.getTarget() === this.refs.navui) {
      this.textNavigator.toggle();
    } else {
      this.textNavigator.setTarget(this.refs.container, this.refs.navui);
      this.textNavigator.setTextInfo(this.state.currentTextInfo);
      this.textNavigator.show();
    }
  }

  handleNavKeydown(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      const userinput = this.refs.navui.value;
      const bibleref = Reference(userinput);

      if (bibleref && bibleref.isValid && bibleref.isValid()) {
        const fragmentid = bibleref.toSection();
        const sectionid = fragmentid.split('_')[0];

        if (sectionid && sectionid !== '' && sectionid !== 'invalid') {
          TextNavigation.locationChange(fragmentid);
          this.scroller.load('text', sectionid, fragmentid);
          this.textNavigator.hide();

          this.refs.navui.value = bibleref.toString();
          this.refs.navui.blur();
        }
      }
    }
  }

  handleTextNavigatorChange(e) {
    const target = e.data.target?.nodeType ? e.data.target : e.data.target?.[0];
    if (target !== this.refs.navui) return;
    TextNavigation.locationChange(e.data.sectionid);
    this.scroller.load('text', e.data.sectionid);
  }

  handleTextChooserChange(e) {
    const target = e.data.target?.nodeType ? e.data.target : e.data.target?.[0];
    if (target !== this.refs.textlistui) return;

    const newTextInfo = e.data.textInfo;

    this.setTextInfoUI(newTextInfo);
    this.updateTabLabel(newTextInfo.abbr);

    this.textNavigator.setTextInfo(newTextInfo);
    this.audioController.setTextInfo(newTextInfo);

    if (this.state.currentTextInfo == null || newTextInfo.id !== this.state.currentTextInfo.id) {
      this.state.currentTextInfo = newTextInfo;

      const oldLocationInfo = this.scroller.getLocationInfo();
      const nearestSectionId = oldLocationInfo?.sectionid ?? newTextInfo.sections[0];

      this.refs.wrapper.innerHTML = '';
      this.scroller.setTextInfo(newTextInfo);
      this.scroller.load('text', nearestSectionId);
    }
  }

  handleMessage(e) {
    const { data } = e;

    if (data.messagetype === 'nav' &&
        (data.type === 'bible' || data.type === 'commentary' || data.type === 'videobible' || data.type === 'deafbible') &&
        data.locationInfo != null) {
      this.scroller.scrollTo(data.locationInfo.fragmentid, data.locationInfo.offset);
    } else if (data.messagetype === 'maprequest' && data.requesttype === 'currentcontent') {
      // MapWindow is requesting current content (happens when MapWindow is created after BibleWindow)
      this.scroller.broadcastCurrentContent();
    }
  }

  async loadInitialText() {
    let textid = this.getParam('textid');

    if (!textid || textid === '') {
      textid = this.state.textType === 'commentary'
        ? this.config.newCommentaryWindowTextId
        : this.config.newBibleWindowVersion;
    }

    try {
      this.state.currentTextInfo = await getTextAsync(textid);
      await this.startup();
    } catch (err) {
      const textInfoData = await loadTextsAsync();

      if (!textInfoData || textInfoData.length === 0) {
        this.showError('No texts available to load');
        return;
      }

      const textsWithType = textInfoData.filter((ti) => ti.type === this.state.textType);

      let newTextInfo = null;
      if (textsWithType.length > 0) {
        newTextInfo = textsWithType[0];
      }

      newTextInfo ??= textInfoData[0];

      if (newTextInfo == null) {
        this.showError('No text info available');
        return;
      }

      this.state.currentTextInfo = await getTextAsync(newTextInfo.id);
      await this.startup();
    }
  }

  async startup() {
    this.textChooser.setTextInfo(this.state.currentTextInfo);
    this.setTextInfoUI(this.state.currentTextInfo);
    this.updateTabLabel(this.state.currentTextInfo.abbr);

    this.textNavigator.setTextInfo(this.state.currentTextInfo);
    this.audioController.setTextInfo(this.state.currentTextInfo);
    this.scroller.setTextInfo(this.state.currentTextInfo);

    let sectionid = this.getParam('sectionid');
    const fragmentid = this.getParam('fragmentid');

    if (!sectionid && fragmentid) {
      sectionid = fragmentid.split('_')[0];
    }

    this.scroller.load('text', sectionid, fragmentid);
  }

  setTextInfoUI(textinfo) {
    if (textinfo.type === 'deafbible') {
      this.refs.textlistui.classList.add('app-list-image');
      this.refs.textlistui.innerHTML = `<img src="${this.config.textsPath}/${textinfo.id}/${textinfo.id}.png" />`;
    } else {
      this.refs.textlistui.classList.remove('app-list-image');
      this.refs.textlistui.innerHTML = textinfo.abbr;
    }
  }

  updateTextnav() {
    const newLocationInfo = this.scroller.getLocationInfo();

    if (newLocationInfo != null) {
      this.state.currentLocationInfo = newLocationInfo;
      this.refs.navui.innerHTML = newLocationInfo.label;
      this.refs.navui.value = newLocationInfo.label;

      this.trigger('settingschange', {
        type: 'settingschange',
        target: this,
        data: this.getData()
      });
    }
  }

  size(width, height) {
    this.refs.container.style.width = `${width}px`;
    this.refs.container.style.height = `${height}px`;

    const headerHeight = this.refs.header.offsetHeight;
    const contentHeight = this.refs.container.offsetHeight - headerHeight;

    this.refs.main.style.width = `${width}px`;
    this.refs.main.style.height = `${contentHeight}px`;

    const containerLeft = this.refs.container.getBoundingClientRect().left;
    this.refs.info.style.top = `${headerHeight + 10}px`;
    this.refs.info.style.left = `${containerLeft}px`;
    this.refs.info.style.width = `${width}px`;
    this.refs.info.style.height = `${contentHeight - 10}px`;

    this.textChooser.size(width, height);
    this.textNavigator.size(width, height);
  }

  getData() {
    let currentTextInfo = this.state.currentTextInfo;
    let currentLocationInfo = this.state.currentLocationInfo;

    if (currentTextInfo == null) {
      currentTextInfo = this.textChooser.getTextInfo();
    }
    if (currentLocationInfo == null) {
      currentLocationInfo = this.scroller.getLocationInfo();
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
      hasFocus: this.state.hasFocus,
      params: {
        win: this.state.textType,
        textid: currentTextInfo.providerid,
        fragmentid: currentLocationInfo.fragmentid
      }
    };
  }
}

/**
 * BibleWindow - Specific implementation for Bible text
 */
export class BibleWindow extends TextWindowComponent {
  constructor() {
    super();
    this.state.textType = 'bible';
  }
}

export class CommentaryWindow extends TextWindowComponent {
  constructor() {
    super();
    this.state.textType = 'commentary';
  }
}

registerWindowComponent('bible-window', BibleWindow, {
  windowType: 'bible',
  displayName: 'Bible',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

registerWindowComponent('commentary-window', CommentaryWindow, {
  windowType: 'commentary',
  displayName: 'Commentary',
  paramKeys: { textid: 't', fragmentid: 'v' }
});

// Export TextWindow as an alias for TextWindowComponent for backwards compatibility
export const TextWindow = TextWindowComponent;

export default TextWindowComponent;
