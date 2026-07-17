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

// Emitters may pass a raw node or a jQuery-style wrapper; unwrap to the node.
const targetNode = (target) => (target?.nodeType ? target : target?.[0]);

// Manifest entries may omit `type`; the convention (shared with TextChooser)
// is that no type means a bible.
const textTypeOf = (t) => (t.type === undefined ? 'bible' : t.type);

const getTextAsync = (textId) => AsyncHelpers.promisifyWithError(getText, textId);
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

    this._versionSiblings = null;
    this._cycleToken = 0;
    this._cycleTargetId = null;
    this._lastNav = null;
  }

  async render() {
    const parentNodeHeight = this.parentElement?.offsetHeight || 600;

    this.innerHTML = `
      <div class="scroller-container">
        <div class="window-header scroller-header">
          <div class="scroller-header-inner">
            <input type="text" class="app-input text-nav" aria-label="${i18nT('windows.bible.gotopassage')}" />
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
            <h2 class="scroller-info-title">${i18nT('windows.bible.versioninfo')}</h2>
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
    this._textChooserHandler = this.bindHandler('textChooserChange', this.handleTextChooserChange);
    this.textChooser.on('change', this._textChooserHandler);

    // Text navigator change - use bound handlers for global singletons
    this._textNavigatorHandler = this.bindHandler('textNavigatorChange', this.handleTextNavigatorChange);
    this.textNavigator.on('change', this._textNavigatorHandler);

    // Focus/blur. Resetting _lastNav lets the next scroll tick re-announce this
    // window's state (document.title follows the focused window).
    this.on('focus', () => { this.state.hasFocus = true; this._lastNav = null; });
    this.on('blur', () => { this.state.hasFocus = false; });

    // Message handling
    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    this.state.textType = this.getParam('textType', this.state.textType || 'bible');

    this.refs.navui.value = i18nT('windows.bible.reference');
    this.refs.textlistui.innerHTML = i18nT('windows.bible.version');

    this.scroller = this.createScroller();
    this.audioController = this.createAudioController();

    this.scroller.on('scroll', () => this.updateTextnav());
    this.scroller.on('locationchange', (e) => this.updateTextnav(e.data));
    this.scroller.on('load', () => this.updateTextnav());
    this.scroller.on('globalmessage', (e) => {
      if ((e.data.messagetype === 'nav' && this.state.hasFocus) || e.data.messagetype !== 'nav') {
        this.trigger('globalmessage', { type: e.type, target: this, data: e.data });
      }
    });

    await this.loadInitialText();
  }

  createScroller() {
    return Scroller(this.refs.main);
  }

  createAudioController() {
    return AudioController(this.windowId, this.refs.container, this.refs.audioui, this.scroller);
  }

  cleanup() {
    if (this._textChooserHandler) {
      this.textChooser.off('change', this._textChooserHandler);
    }
    if (this._textNavigatorHandler) {
      this.textNavigator.off('change', this._textNavigatorHandler);
    }

    super.cleanup();

    // The chooser and navigator are global singletons; only dismiss them if
    // they're open on this window.
    if (this.textChooser.getTarget() === this.refs.textlistui) this.textChooser.hide();
    if (this.textNavigator.getTarget() === this.refs.navui) this.textNavigator.hide();

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
    const textInfo = this.state.currentTextInfo;
    if (textInfo) {
      this.refs.infoTitle.textContent = i18nT('windows.bible.versioninfoname', [textInfo.name || textInfo.abbr]);
    }

    if (textInfo?.aboutHtml) {
      this.refs.infoContent.innerHTML = textInfo.aboutHtml;
    } else {
      this.refs.infoContent.innerHTML = `<div class="loading-indicator">${i18nT('windows.bible.loadinginfo')}</div>`;

      try {
        const response = await fetch(`${this.config.baseContentUrl}${this.config.textsPath}/${textInfo.id}/about.html`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const htmlString = await response.text();
        const breakTag = '<body';
        const fixedHtml = htmlString.indexOf(breakTag) > -1
          ? breakTag + htmlString.split(breakTag)[1]
          : '';
        if (!fixedHtml) throw new Error('about.html has no body');

        this.refs.infoContent.innerHTML = fixedHtml;
        textInfo.aboutHtml = fixedHtml;
      } catch {
        this.refs.infoContent.innerHTML = `
          <div class="scroller-info-empty">
            <p>${i18nT('windows.bible.noinfo')}</p>
            <p class="scroller-info-version-name">${textInfo?.name || textInfo?.abbr || ''}</p>
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
    if (e.key !== 'Enter') return;

    const bibleref = Reference(this.refs.navui.value);
    if (!bibleref?.isValid?.()) return;

    const fragmentid = bibleref.toSection();
    const sectionid = fragmentid.split('_')[0];
    if (!sectionid || sectionid === 'invalid') return;

    TextNavigation.locationChange(fragmentid);
    this.scroller.load('text', sectionid, fragmentid);
    this.broadcastNav(sectionid, fragmentid);
    this.textNavigator.hide();

    this.refs.navui.value = bibleref.toString();
    this.refs.navui.blur();
  }

  handleTextNavigatorChange(e) {
    if (targetNode(e.data.target) !== this.refs.navui) return;
    const { sectionid, fragmentid } = e.data;
    TextNavigation.locationChange(fragmentid || sectionid);
    this.scroller.load('text', sectionid, fragmentid);
    this.broadcastNav(sectionid, fragmentid);
  }

  // Announce an explicit navigation (navigator pick or typed reference) to the
  // other linked windows. Scroll-driven nav sync only fires on user scrolls —
  // programmatic scrolls are suppressed to prevent echo loops — so without this
  // the other windows wouldn't follow until the next manual scroll.
  broadcastNav(sectionid, fragmentid) {
    this.trigger('globalmessage', {
      type: 'globalmessage',
      target: this,
      data: {
        messagetype: 'nav',
        type: this.state.currentTextInfo?.type?.toLowerCase() ?? 'bible',
        locationInfo: {
          fragmentid: fragmentid || `${sectionid}_1`,
          sectionid,
          offset: 0
        }
      }
    });
  }

  handleTextChooserChange(e) {
    if (targetNode(e.data.target) !== this.refs.textlistui) return;

    this.changeText(e.data.textInfo);
  }

  // Switch the window to a different version, reloading the current location in
  // the new text. Shared by the chooser dropdown and the version cycler arrows.
  changeText(newTextInfo) {
    if (!newTextInfo) return;

    this.setTextInfoUI(newTextInfo);
    this.updateTabLabel(displayAbbr(newTextInfo));

    this.textNavigator.setTextInfo(newTextInfo);
    this.audioController?.setTextInfo(newTextInfo);

    if (this.state.currentTextInfo == null || newTextInfo.id !== this.state.currentTextInfo.id) {
      this.state.currentTextInfo = newTextInfo;

      // A completed change supersedes any in-flight version-cycle probe.
      this._cycleToken++;
      this._cycleTargetId = null;

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

    // Anchor on the version a still-loading cycle is heading toward, so rapid
    // clicks advance one step each instead of re-probing from the same start.
    const anchorId = this._cycleTargetId ?? current.id;
    let startIndex = siblings.findIndex((t) => t.id === anchorId);
    if (startIndex === -1) startIndex = siblings.findIndex((t) => t.id === current.id);
    if (startIndex === -1) startIndex = 0;

    // Probe candidates outward from the anchor until one contains the
    // reference. Each getText is cached after first load. The token invalidates
    // in-flight probes superseded by a newer click or a chooser change.
    const token = ++this._cycleToken;
    const order = probeOrder(siblings.length, startIndex, direction);
    const tryNext = (i) => {
      if (i >= order.length) { // no other version has this reference
        if (this._cycleToken === token) this._cycleTargetId = null;
        return;
      }
      const candidate = siblings[order[i]];
      if (!candidate || candidate.id === current.id) {
        tryNext(i + 1);
        return;
      }

      this._cycleTargetId = candidate.id;
      getText(candidate.id, (info) => {
        if (this._cycleToken !== token) return; // superseded
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
      .filter((t) => t.hasText !== false && textTypeOf(t) === type && langOf(t) === langKey)
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

  getDefaultTextId() {
    switch (this.state.textType) {
      case 'commentary':
        return this.config.newCommentaryWindowTextId;
      case 'deafbible':
        return this.config.deafBibleWindowDefaultBibleVersion;
      default:
        return this.config.newBibleWindowVersion;
    }
  }

  async loadInitialText() {
    let textid = this.getParam('textid');

    if (!textid || textid === '') {
      textid = this.getDefaultTextId();
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

      // The first attempt may have failed only because the manifest wasn't loaded
      // yet (e.g. a deep link to an online text). Retry now that they all are.
      try {
        this.state.currentTextInfo = await getTextAsync(textid);
        await this.startup();
        return;
      } catch { /* fall through to the first-available text */ }

      const newTextInfo = textInfoData.find(
        (ti) => ti.hasText !== false && textTypeOf(ti) === this.state.textType
      ) ?? textInfoData[0];

      try {
        this.state.currentTextInfo = await getTextAsync(newTextInfo.id);
        await this.startup();
      } catch {
        this.showError('Unable to load text');
      }
    }
  }

  async startup() {
    this.textChooser.setTextInfo(this.state.currentTextInfo);
    this.setTextInfoUI(this.state.currentTextInfo);
    this.updateTabLabel(displayAbbr(this.state.currentTextInfo));

    this.textNavigator.setTextInfo(this.state.currentTextInfo);
    this.audioController?.setTextInfo(this.state.currentTextInfo);
    this.scroller.setTextInfo(this.state.currentTextInfo);

    this.updateVersionCycler();

    let sectionid = this.getParam('sectionid');
    let fragmentid = this.getParam('fragmentid');

    if (!sectionid && !fragmentid && this.state.textType === 'deafbible') {
      fragmentid = this.config.deafBibleWindowDefaultBibleFragmentid;
    }

    if (!sectionid && fragmentid) {
      sectionid = fragmentid.split('_')[0];
    }

    this.scroller.load('text', sectionid, fragmentid);
  }

  setTextInfoUI(textinfo) {
    if (textinfo.type === 'deafbible') {
      this.refs.textlistui.classList.add('app-list-image');
      const cover = textinfo.cover || `${this.config.baseContentUrl}${this.config.textsPath}/${textinfo.id}/${textinfo.id}.png`;
      this.refs.textlistui.innerHTML = `<img src="${cover}" />`;
    } else {
      this.refs.textlistui.classList.remove('app-list-image');
      this.refs.textlistui.innerHTML = displayAbbr(textinfo);
    }
  }

  // Refresh the reference input and announce this window's state. Wired to
  // every scroller event ('scroll' fires per tick), so skip the settingschange
  // unless the location or version actually changed — downstream it rewrites
  // document.title and schedules a settings save.
  updateTextnav(locationInfo = null) {
    // On 'locationchange' the scroller triggers before committing the new
    // location, so getLocationInfo() is stale; prefer the event payload.
    const newLocationInfo = locationInfo ?? this.scroller.getLocationInfo();
    if (newLocationInfo == null) return;

    this.state.currentLocationInfo = newLocationInfo;
    this.refs.navui.value = newLocationInfo.label;

    const textid = this.state.currentTextInfo?.id;
    if (this._lastNav && this._lastNav.textid === textid && this._lastNav.fragmentid === newLocationInfo.fragmentid) return;
    this._lastNav = { textid, fragmentid: newLocationInfo.fragmentid };

    this.trigger('settingschange', {
      type: 'settingschange',
      target: this,
      data: this.getData()
    });
  }

  size(width, height) {
    this.refs.container.style.width = `${width}px`;
    this.refs.container.style.height = `${height}px`;

    const contentHeight = height - this.refs.header.offsetHeight;

    this.refs.main.style.width = `${width}px`;
    this.refs.main.style.height = `${contentHeight}px`;

    this.textChooser.size(width, height);
    this.textNavigator.size(width, height);
  }

  getData() {
    const currentTextInfo = this.state.currentTextInfo;
    const currentLocationInfo = this.state.currentLocationInfo ?? this.scroller?.getLocationInfo();

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
