/**
 * TextWindow - Web Component for displaying Bible/Commentary text
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { Scroller } from './Scroller.js';
import { AudioController } from './AudioController.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { getGlobalTextNavigator } from '../ui/TextNavigator.js';
import { getText, loadTexts, displayAbbr } from '../texts/TextLoader.js';
import { TextNavigation } from '../common/TextNavigation.js';
import { t as i18nT } from '../lib/i18n.js';
import { versionHasSection, probeOrder } from './versionCycle.js';
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
            <span class="version-cycler">
              <button type="button" class="version-arrow version-prev" tabindex="-1" title="${i18nT('windows.bible.prevversion')}" aria-label="${i18nT('windows.bible.prevversion')}">&lsaquo;</button>
              <div class="app-list text-list"></div>
              <button type="button" class="version-arrow version-next" tabindex="-1" title="${i18nT('windows.bible.nextversion')}" aria-label="${i18nT('windows.bible.nextversion')}">&rsaquo;</button>
            </span>
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
    this.refs.versionCycler = this.$('.version-cycler');
    this.refs.versionPrev = this.$('.version-prev');
    this.refs.versionNext = this.$('.version-next');
  }

  attachEventListeners() {
    // Info popover close button
    this.addListener(this.refs.infoCloseBtn, 'click', () => this.handleInfoClose());

    // Info button - toggle popover
    this.addListener(this.refs.infoBtn, 'click', () => this.handleInfoToggle());

    // Text chooser button
    this.addListener(this.refs.textlistui, 'click', () => this.handleTextListClick());

    // Version cycler arrows - step through versions in the current language
    this.addListener(this.refs.versionPrev, 'click', () => this.cycleVersion(-1));
    this.addListener(this.refs.versionNext, 'click', () => this.cycleVersion(1));

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
    const { sectionid, fragmentid } = e.data;
    TextNavigation.locationChange(fragmentid || sectionid);
    this.scroller.load('text', sectionid, fragmentid);
  }

  handleTextChooserChange(e) {
    const target = e.data.target?.nodeType ? e.data.target : e.data.target?.[0];
    if (target !== this.refs.textlistui) return;

    this.changeText(e.data.textInfo);
  }

  // Switch the window to a different version, reloading the current location in
  // the new text. Shared by the chooser dropdown and the version cycler arrows.
  changeText(newTextInfo) {
    if (!newTextInfo) return;

    this.setTextInfoUI(newTextInfo);
    this.updateTabLabel(displayAbbr(newTextInfo));

    this.textNavigator.setTextInfo(newTextInfo);
    this.audioController.setTextInfo(newTextInfo);

    if (this.state.currentTextInfo == null || newTextInfo.id !== this.state.currentTextInfo.id) {
      this.state.currentTextInfo = newTextInfo;

      // Preserve the reader's place. The scroller's live location can be
      // momentarily null mid-load, so fall back to the last known location;
      // otherwise we'd reset to sections[0] (Genesis 1). Passing the fragmentid
      // lands on the same verse and makes the scroller recompute its location
      // after loading (it skips that when no fragmentid is given).
      const oldLocationInfo = this.scroller.getLocationInfo() ?? this.state.currentLocationInfo;
      const nearestSectionId = oldLocationInfo?.sectionid ?? newTextInfo.sections[0];
      const fragmentid = oldLocationInfo?.fragmentid;

      this.refs.wrapper.innerHTML = '';
      this.scroller.setTextInfo(newTextInfo);
      this.scroller.load('text', nearestSectionId, fragmentid);

      this.updateVersionCycler();
    }
  }

  // Step to the previous/next version in the current language (direction -1/+1),
  // wrapping around. Versions that don't contain the current reference are
  // skipped, so cycling lands on the next version that can actually show it.
  // Keeps the chooser's selection in sync so the dropdown and its pinned
  // "current language" section reflect the cycled version.
  cycleVersion(direction) {
    const siblings = this._versionSiblings;
    const current = this.state.currentTextInfo;
    if (!siblings || siblings.length < 2 || current == null) return;

    const sectionid = this.scroller.getLocationInfo()?.sectionid
      ?? this.state.currentLocationInfo?.sectionid;

    let startIndex = siblings.findIndex((t) => t.id === current.id);
    if (startIndex === -1) startIndex = 0;

    // Probe candidates outward from the current version until one contains the
    // reference. Each getText is cached after first load.
    const order = probeOrder(siblings.length, startIndex, direction);
    const tryNext = (i) => {
      if (i >= order.length) return; // no other version has this reference
      const candidate = siblings[order[i]];
      if (!candidate || candidate.id === current.id) {
        tryNext(i + 1);
        return;
      }

      getText(candidate.id, (info) => {
        if (info && versionHasSection(info, sectionid)) {
          this.textChooser.setTextInfo(info);
          this.changeText(info);
        } else {
          tryNext(i + 1);
        }
      });
    };

    tryNext(0);
  }

  // Recompute the same-language version list and show/hide the cycler arrows.
  // Arrows appear only when the current language has more than one version of
  // this window's text type.
  updateVersionCycler() {
    const current = this.state.currentTextInfo;
    if (!current || !this.refs.versionCycler) {
      this.setVersionSiblings([]);
      return;
    }

    loadTexts((data) => {
      // The version may have changed again while the manifest was loading.
      if (this.state.currentTextInfo !== current) return;
      this.setVersionSiblings(this.getLanguageSiblings(data, current));
    });
  }

  // Versions sharing the current text's language and type, ordered the same way
  // the TextChooser lists them (by name) so cycling matches the dropdown order.
  getLanguageSiblings(data, textInfo) {
    const type = this.state.textType;
    const langOf = (t) => t.langNameEnglish || t.langName || '';

    // Resolve the language from the manifest entry so grouping matches the
    // TextChooser; a text's own info.json may omit the language fields.
    const entry = data.find((t) => t.id === textInfo.id);
    const langKey = entry ? langOf(entry) : langOf(textInfo);

    return data
      .filter((t) => {
        if (t.hasText === false) return false;
        const thisType = t.type === undefined ? 'bible' : t.type;
        return thisType === type && langOf(t) === langKey;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  setVersionSiblings(siblings) {
    this._versionSiblings = siblings;
    this.refs.versionCycler?.classList.toggle('has-versions', siblings.length > 1);
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
    this.updateTabLabel(displayAbbr(this.state.currentTextInfo));

    this.textNavigator.setTextInfo(this.state.currentTextInfo);
    this.audioController.setTextInfo(this.state.currentTextInfo);
    this.scroller.setTextInfo(this.state.currentTextInfo);

    this.updateVersionCycler();

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
      this.refs.textlistui.innerHTML = displayAbbr(textinfo);
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
      labelTab: displayAbbr(currentTextInfo),
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
