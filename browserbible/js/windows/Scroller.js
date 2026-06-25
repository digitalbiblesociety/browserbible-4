/**
 * Scroller
 * Handles infinite scrolling of Bible text with chapter loading
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { getConfig } from '../core/config.js';
import { Reference } from '../bible/BibleReference.js';
import { APOCRYPHAL_BIBLE } from '../bible/BibleData.js';
import { getShowApocrypha, skipApocryphalSection } from '../bible/Apocrypha.js';
import { loadSection } from '../texts/TextLoader.js';

const findNearestSection = (desiredSectionid, sections) => {
  if (!sections || sections.length === 0) return null;
  if (sections.indexOf(desiredSectionid) !== -1) return desiredSectionid;

  const bookid = desiredSectionid.substring(0, 2);
  const chapterNum = parseInt(desiredSectionid.substring(2), 10) || 1;

  const sameBook = sections.filter(s => s.startsWith(bookid));
  if (sameBook.length > 0) {
    return sameBook.reduce((best, s) => {
      const sCh = parseInt(s.substring(2), 10);
      const bestCh = parseInt(best.substring(2), 10);
      return Math.abs(sCh - chapterNum) < Math.abs(bestCh - chapterNum) ? s : best;
    });
  }

  const desiredIdx = APOCRYPHAL_BIBLE.indexOf(bookid);
  if (desiredIdx === -1) return sections[0];

  return sections.reduce((best, s) => {
    const sIdx = APOCRYPHAL_BIBLE.indexOf(s.substring(0, 2));
    const bestIdx = APOCRYPHAL_BIBLE.indexOf(best.substring(0, 2));
    return Math.abs(sIdx - desiredIdx) < Math.abs(bestIdx - desiredIdx) ? s : best;
  });
};

const SCROLL_THRESHOLDS = {
  LOAD_MORE_MULTIPLIER: 2,
  TRIM_TOP_MULTIPLIER: 15,
  TRIM_BOTTOM_MULTIPLIER: 15,
  MAX_SECTIONS: 50,
  MIN_SECTIONS_FOR_TRIM: 4,
  POSITION_TOLERANCE: -2
};

const SPEED_CHECK_INTERVAL = 100;

const TEXT_TYPES = {
  BIBLE: 'bible',
  COMMENTARY: 'commentary',
  VIDEOBIBLE: 'videobible',
  DEAFBIBLE: 'deafbible',
  BOOK: 'book'
};

const getFragmentSelector = (textType) => {
  switch (textType) {
    case TEXT_TYPES.BIBLE:
    case TEXT_TYPES.COMMENTARY:
    case TEXT_TYPES.VIDEOBIBLE:
    case TEXT_TYPES.DEAFBIBLE:
      return '.verse, .v';
    case TEXT_TYPES.BOOK:
      return '.page';
    default:
      return '.verse, .v';
  }
};

const isFirstFragmentVisible = (fragment, topOfContentArea) => {
  return offset(fragment).top - topOfContentArea > SCROLL_THRESHOLDS.POSITION_TOLERANCE;
};

const createLocationInfo = (fragment, currentTextInfo, topOfContentArea) => {
  const fragmentid = fragment.getAttribute('data-id');
  const closestSection = fragment.closest('.section');

  // Core location data needed for sync
  const info = {
    fragmentid,
    sectionid: fragment.classList.contains('section')
      ? fragmentid
      : (closestSection?.getAttribute('data-id') ?? ''),
    offset: topOfContentArea - offset(fragment).top,
    textid: currentTextInfo?.id ?? '',
    _textInfo: currentTextInfo // Store for lazy label generation
  };

  // Lazy label generation - only computed when accessed
  Object.defineProperty(info, 'label', {
    get() {
      if (this._label === undefined) {
        this._computeLabels();
      }
      return this._label;
    },
    enumerable: true
  });

  Object.defineProperty(info, 'labelLong', {
    get() {
      if (this._labelLong === undefined) {
        this._computeLabels();
      }
      return this._labelLong;
    },
    enumerable: true
  });

  info._computeLabels = function() {
    const textType = this._textInfo?.type?.toLowerCase() ?? TEXT_TYPES.BIBLE;
    this._label = '';
    this._labelLong = '';

    if ([TEXT_TYPES.BIBLE, TEXT_TYPES.COMMENTARY, TEXT_TYPES.VIDEOBIBLE, TEXT_TYPES.DEAFBIBLE].includes(textType)) {
      const bibleref = Reference(this.fragmentid);
      if (bibleref && this._textInfo) {
        bibleref.language = this._textInfo.lang;
        this._label = bibleref.toString();
        this._labelLong = `${this._label} (${this._textInfo.abbr})`;
      }
    } else if (textType === TEXT_TYPES.BOOK && this._textInfo) {
      this._labelLong = this._label = `${this._textInfo.name} ${this.fragmentid}`;
    }
  };

  return info;
};

export function Scroller(node) {
  const nodeEl = node?.nodeType ? node : node?.[0];
  const wrapper = nodeEl.querySelector('.scroller-text-wrapper');

  let currentTextInfo = null;
  let locationInfo = {};
  let ignoreScrollEvent = false;
  let speedLastPos = null;
  let speedDelta = 0;
  let globalTimeout = null;
  let speedInterval = null;

  const speedIndicator = elem('div', {
    className: 'scroller-speed',
    style: { zIndex: 50, position: 'absolute', top: 0, left: 0, width: '50px', background: 'black', padding: '5px', color: '#fff' }
  });
  if (nodeEl.parentNode) {
    nodeEl.parentNode.appendChild(speedIndicator);
  }
  speedIndicator.style.display = 'none';

  const startGlobalTimeout = () => {
    if (globalTimeout == null) {
      globalTimeout = requestAnimationFrame(triggerGlobalEvent);
    }
  };

  const triggerGlobalEvent = () => {
    if (currentTextInfo) {
      ext.trigger('globalmessage', {
        type: 'globalmessage',
        target: this,
        data: {
          messagetype: 'nav',
          type: currentTextInfo.type ? currentTextInfo.type.toLowerCase() : TEXT_TYPES.BIBLE,
          locationInfo
        }
      });
    }
    cancelAnimationFrame(globalTimeout);
    globalTimeout = null;
  };

  const handleScroll = () => {
    if (ignoreScrollEvent) return;

    updateLocationInfo();
    ext.trigger('scroll', { type: 'scroll', target: this, data: { locationInfo } });
    startGlobalTimeout();
    startSpeedTest();
  };

  nodeEl.addEventListener('scroll', handleScroll);

  const startSpeedTest = () => {
    if (speedInterval == null) {
      speedInterval = setInterval(checkSpeed, SPEED_CHECK_INTERVAL);
    }
  };

  const stopSpeedTest = () => {
    if (speedInterval != null) {
      clearInterval(speedInterval);
      speedInterval = null;
    }
  };

  const checkSpeed = () => {
    const speedNewPos = nodeEl.scrollTop;
    if (speedLastPos != null) {
      speedDelta = speedNewPos - speedLastPos;
    }
    speedLastPos = speedNewPos;

    if (speedDelta === 0) {
      loadMore();
      stopSpeedTest();
    }
  };

  const findFirstVisibleFragment = (fragments, topOfContentArea) => {
    for (const fragment of fragments) {
      let currentFragment = fragment;

      if (isFirstFragmentVisible(currentFragment, topOfContentArea)) {
        const fragmentid = currentFragment.getAttribute('data-id');
        const totalFragments = currentFragment.parentNode?.querySelectorAll(`.${fragmentid}`) ?? [];

        if (totalFragments.length > 1) {
          currentFragment = totalFragments[0];
          if (!isFirstFragmentVisible(currentFragment, topOfContentArea)) {
            continue;
          }
        }

        return currentFragment;
      }
    }
    return null;
  };

  const updateLocationInfo = () => {
    const topOfContentArea = offset(nodeEl).top;
    const fragmentSelector = currentTextInfo?.fragmentSelector ||
      getFragmentSelector(currentTextInfo?.type?.toLowerCase());

    let fragments = nodeEl.querySelectorAll(fragmentSelector);
    if (fragments.length === 1) {
      fragments = nodeEl.querySelectorAll('.section');
    }

    const firstVisibleFragment = findFirstVisibleFragment(fragments, topOfContentArea);
    const newLocationInfo = firstVisibleFragment
      ? createLocationInfo(firstVisibleFragment, currentTextInfo, topOfContentArea)
      : null;

    if (newLocationInfo != null && (locationInfo == null || newLocationInfo.fragmentid !== locationInfo.fragmentid)) {
      ext.trigger('locationchange', { type: 'locationchange', target: this, data: newLocationInfo });
    }

    locationInfo = newLocationInfo;
  };

  const shouldLoadNext = (belowBottom, nodeHeight, sections) => {
    return belowBottom < nodeHeight * SCROLL_THRESHOLDS.LOAD_MORE_MULTIPLIER &&
           sections.length < SCROLL_THRESHOLDS.MAX_SECTIONS;
  };

  const shouldLoadPrev = (aboveTop, nodeHeight, sections) => {
    return aboveTop < nodeHeight * SCROLL_THRESHOLDS.LOAD_MORE_MULTIPLIER &&
           sections.length < SCROLL_THRESHOLDS.MAX_SECTIONS;
  };

  const shouldTrimTop = (aboveTop, nodeHeight, sectionsCount) => {
    return aboveTop > nodeHeight * SCROLL_THRESHOLDS.TRIM_TOP_MULTIPLIER &&
           sectionsCount >= 2;
  };

  const shouldTrimBottom = (belowBottom, nodeHeight, sectionsCount) => {
    return belowBottom > nodeHeight * SCROLL_THRESHOLDS.TRIM_BOTTOM_MULTIPLIER &&
           sectionsCount > SCROLL_THRESHOLDS.MIN_SECTIONS_FOR_TRIM;
  };

  const trimTopSection = () => {
    const secondSection = wrapper.querySelectorAll('.section')[1];
    const firstNodeOfSecondSection = secondSection?.firstElementChild ?? null;
    const firstNodeOffsetBefore = firstNodeOfSecondSection ? offset(firstNodeOfSecondSection).top : 0;

    const firstSection = wrapper.querySelector('.section');
    if (firstSection) firstSection.parentNode.removeChild(firstSection);

    const firstNodeOffsetAfter = firstNodeOfSecondSection ? offset(firstNodeOfSecondSection).top : 0;
    const offsetDifference = firstNodeOffsetAfter - firstNodeOffsetBefore;
    nodeEl.scrollTop -= Math.abs(offsetDifference);
  };

  const trimBottomSection = () => {
    const lastSection = wrapper.querySelector('.section:last-child');
    if (lastSection) lastSection.parentNode.removeChild(lastSection);
  };

  // When apocrypha is hidden, walk past apocryphal sections in the scroll
  // direction (+1 next / -1 prev) so they're skipped during continuous reading.
  // Returns the first non-apocryphal section id, or null if the run hits the
  // end of the text.
  const nextVisibleSection = (sectionid, direction) => {
    if (!sectionid || sectionid === 'null' || getShowApocrypha()) return sectionid;
    return skipApocryphalSection(sectionid, direction, currentTextInfo?.sections);
  };

  const loadMore = () => {
    if (!wrapper || speedDelta !== 0) return;

    const wrapperHeight = wrapper.offsetHeight;
    const nodeHeight = nodeEl.offsetHeight;
    const nodeScrolltop = nodeEl.scrollTop;
    const sections = wrapper.querySelectorAll('.section');
    const sectionsCount = sections.length;

    const aboveTop = nodeScrolltop;
    const belowBottom = wrapperHeight - nodeHeight - nodeScrolltop;

    if (shouldLoadNext(belowBottom, nodeHeight, sections)) {
      const lastSection = sections[sections.length - 1];
      const nextid = nextVisibleSection(lastSection?.getAttribute('data-nextid'), 1);
      if (nextid && nextid !== 'null') {
        load('next', nextid);
      }
    } else if (shouldLoadPrev(aboveTop, nodeHeight, sections)) {
      const firstSection = sections[0];
      const previd = nextVisibleSection(firstSection?.getAttribute('data-previd'), -1);
      if (previd && previd !== 'null') {
        load('prev', previd);
      }
    } else if (shouldTrimTop(aboveTop, nodeHeight, sectionsCount)) {
      trimTopSection();
    } else if (shouldTrimBottom(belowBottom, nodeHeight, sectionsCount)) {
      trimBottomSection();
    }
  };

  const isAlreadyLoaded = (loadType, sectionid, fragmentid) => {
    if (!wrapper.querySelector(`.${sectionid}`)) return false;

    // The section is already in the DOM. For an explicit navigation ('text'),
    // still scroll to it: to the fragment when one is given and present,
    // otherwise to the top of the section. ('next'/'prev' loads must not jump.)
    if (loadType === 'text') {
      const targetid = fragmentid?.trim() && wrapper.querySelector(`.${fragmentid}`)
        ? fragmentid
        : sectionid;
      scrollTo(targetid);
      locationInfo = null;
      updateLocationInfo();
    }
    return true;
  };

  const insertContent = (loadType, content, nodeScrolltopBefore, wrapperHeightBefore) => {
    let contentEl = null;
    if (typeof content !== 'string') {
      contentEl = content?.nodeType ? content : content?.[0];
    }

    switch (loadType) {
      case 'text':
        wrapper.innerHTML = '';
        nodeEl.scrollTop = 0;
        if (typeof content === 'string') {
          wrapper.innerHTML = content;
        } else if (contentEl) {
          wrapper.appendChild(contentEl);
        }
        break;

      case 'next':
        if (typeof content === 'string') {
          wrapper.insertAdjacentHTML('beforeend', content);
        } else if (contentEl) {
          wrapper.appendChild(contentEl);
        }
        break;

      case 'prev':
        if (typeof content === 'string') {
          wrapper.insertAdjacentHTML('afterbegin', content);
        } else if (contentEl) {
          wrapper.insertBefore(contentEl, wrapper.firstChild);
        }
        const wrapperHeightAfter = wrapper.offsetHeight;
        const heightDifference = wrapperHeightAfter - wrapperHeightBefore;
        nodeEl.scrollTop = nodeScrolltopBefore + heightDifference;
        break;
    }
  };

  const formatSectionLabel = (sectionid) => {
    const ref = Reference(sectionid);
    if (!ref) return sectionid;
    if (currentTextInfo?.lang) ref.language = currentTextInfo.lang;
    return ref.toString() || sectionid;
  };

  const showChapterUnavailable = (sectionid) => {
    if (!wrapper) return;

    const requestedLabel = formatSectionLabel(sectionid);
    const nearest = findNearestSection(sectionid, currentTextInfo?.sections);

    wrapper.innerHTML = '';
    nodeEl.scrollTop = 0;

    const container = elem('div', { className: 'chapter-unavailable' });
    const message = elem('p', { className: 'chapter-unavailable-message' });
    message.textContent = `${requestedLabel} is not available in this text.`;
    container.appendChild(message);

    if (nearest && nearest !== sectionid) {
      const link = elem('a', { className: 'chapter-unavailable-link', href: '#' });
      link.textContent = `Go to ${formatSectionLabel(nearest)}`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        load('text', nearest);
      });
      container.appendChild(link);
    }

    wrapper.appendChild(container);
  };

  const load = (loadType, sectionid, fragmentid) => {
    if (sectionid === 'null' || sectionid === null || sectionid === '') return;
    if (!wrapper) return;

    if (isAlreadyLoaded(loadType, sectionid, fragmentid)) return;

    if (loadType === 'text') {
      wrapper.innerHTML = `<div class="loading-indicator" style="height:${nodeEl.offsetHeight}px;"></div>`;
      nodeEl.scrollTop = 0;
    }

    const nodeScrolltopBefore = nodeEl.scrollTop;
    const wrapperHeightBefore = wrapper.offsetHeight;

    const handleLoadError = () => {
      if (!wrapper) return;
      if (loadType === 'text') {
        showChapterUnavailable(sectionid);
      }
    };

    loadSection(currentTextInfo, sectionid, (content) => {
      if (!wrapper || isAlreadyLoaded(loadType, sectionid, fragmentid)) return;

      ignoreScrollEvent = true;
      insertContent(loadType, content, nodeScrolltopBefore, wrapperHeightBefore);

      if (loadType === 'text' && fragmentid) {
        scrollTo(fragmentid);
        locationInfo = null;
        updateLocationInfo();
      }

      ignoreScrollEvent = false;

      if (currentTextInfo) {
        ext.trigger('globalmessage', {
          type: 'globalmessage',
          target: this,
          data: {
            messagetype: 'textload',
            texttype: currentTextInfo.type?.toLowerCase() ?? TEXT_TYPES.BIBLE,
            type: currentTextInfo.type?.toLowerCase() ?? TEXT_TYPES.BIBLE,
            textid: currentTextInfo.id,
            abbr: currentTextInfo.abbr,
            sectionid,
            fragmentid,
            content
          }
        });
      }

      loadMore();
    }, handleLoadError);
  };

  const scrollTo = (fragmentid, scrollOffset) => {
    if (fragmentid == null || !wrapper) return;

    const fragment = wrapper.querySelector(`.${fragmentid}`);

    if (fragment) {
      const paneTop = offset(nodeEl).top;
      const scrollTop = nodeEl.scrollTop;
      const nodeTop = offset(fragment).top;
      const nodeTopAdjusted = nodeTop - paneTop + scrollTop;

      ignoreScrollEvent = true;
      nodeEl.scrollTop = nodeTopAdjusted + (scrollOffset || 0);
      ignoreScrollEvent = false;
    } else {
      const sectionid = fragmentid.split('_')[0];
      const hasSection = currentTextInfo?.sections?.indexOf(sectionid) > -1;

      if (hasSection) {
        load('text', sectionid, fragmentid);
      }
    }
  };

  const size = (width, height) => {
    nodeEl.style.width = `${width}px`;
    nodeEl.style.height = `${height}px`;
  };

  const getTextInfo = () => currentTextInfo;

  const setTextInfo = (textinfo) => {
    const config = getConfig();

    if (textinfo?.stylesheet !== undefined) {
      const styleId = `style-${textinfo.id}`;
      let styleLink = document.getElementById(styleId);

      if (!styleLink) {
        styleLink = elem('link', {
          id: styleId,
          rel: 'stylesheet',
          href: `${config.baseContentUrl}${config.textsPath}/${textinfo.id}/${textinfo.stylesheet}`
        });
        document.head.appendChild(styleLink);
      }
    }

    currentTextInfo = textinfo;
  };

  const getLocationInfo = () => locationInfo;

  const close = () => {
    nodeEl.removeEventListener('scroll', handleScroll);
    stopSpeedTest();

    if (globalTimeout != null) {
      cancelAnimationFrame(globalTimeout);
      globalTimeout = null;
    }

    if (speedIndicator.parentNode) {
      speedIndicator.parentNode.removeChild(speedIndicator);
    }

    ext.clearListeners();
  };

  const broadcastCurrentContent = () => {
    // Re-broadcast current content for newly created windows (e.g., MapWindow, MediaWindow)
    if (!wrapper || !currentTextInfo || !locationInfo?.sectionid) {
      return;
    }

    // Send only the current section, matching the single-section contract of the
    // textload message fired from load(). The wrapper can hold several loaded
    // sections; shipping all of them led consumers to mis-key the content.
    const sectionEl = wrapper.querySelector(`.section[data-id="${locationInfo.sectionid}"]`);
    const content = sectionEl ? sectionEl.outerHTML : wrapper.innerHTML;
    if (!content || content.trim() === '') {
      return;
    }

    ext.trigger('globalmessage', {
      type: 'globalmessage',
      target: this,
      data: {
        messagetype: 'textload',
        texttype: currentTextInfo.type?.toLowerCase() ?? TEXT_TYPES.BIBLE,
        type: currentTextInfo.type?.toLowerCase() ?? TEXT_TYPES.BIBLE,
        textid: currentTextInfo.id,
        abbr: currentTextInfo.abbr,
        sectionid: locationInfo.sectionid,
        fragmentid: locationInfo.fragmentid,
        content
      }
    });
  };

  let ext = {
    loadMore,
    load,
    size,
    getTextInfo,
    setTextInfo,
    getLocationInfo,
    scrollTo,
    close,
    broadcastCurrentContent
  };

  mixinEventEmitter(ext);
  ext._events = {};

  return ext;
}
