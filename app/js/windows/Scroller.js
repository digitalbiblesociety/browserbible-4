/**
 * Scroller
 * Handles infinite scrolling of Bible text with chapter loading
 */

import { createElements, offset, closest, deepMerge, toElement } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';
import { getConfig } from '../core/config.js';
import { Reference } from '../bible/BibleReference.js';
import { loadSection } from '../texts/TextLoader.js';

/**
 * Create a scroller for text content
 * @param {HTMLElement} node - The container element
 * @returns {Object} Scroller API object
 */
export function Scroller(node) {
  const nodeEl = toElement(node);
  const wrapper = nodeEl.querySelector('.scroller-text-wrapper');

  let currentTextInfo = null;
  let locationInfo = {};
  let ignoreScrollEvent = false;
  let speedLastPos = null;
  let speedDelta = 0;
  let globalTimeout = null;
  let speedInterval = null;

  const speedIndicator = createElements('<div class="scroller-speed" style="z-index: 50; position: absolute; top: 0; left: 0; width: 50; background: black; padding: 5px;color:#fff"></div>');
  if (nodeEl.parentNode) {
    nodeEl.parentNode.appendChild(speedIndicator);
  }
  speedIndicator.style.display = 'none';

  const startGlobalTimeout = () => {
    if (globalTimeout == null) {
      setTimeout(triggerGlobalEvent, 10);
    }
  };

  const triggerGlobalEvent = () => {
    if (currentTextInfo) {
      ext.trigger('globalmessage', {
        type: 'globalmessage',
        target: this,
        data: {
          messagetype: 'nav',
          type: currentTextInfo.type ? currentTextInfo.type.toLowerCase() : 'bible',
          locationInfo
        }
      });
    }
    clearTimeout(globalTimeout);
    globalTimeout = null;
  };

  const handleScroll = () => {
    if (ignoreScrollEvent) return;

    updateLocationInfo();
    ext.trigger('scroll', { type: 'scroll', target: this, data: { locationInfo } });
    startGlobalTimeout();
    startSpeedTest();
  };

  nodeEl.addEventListener('scroll', handleScroll, false);

  const startSpeedTest = () => {
    if (speedInterval == null) {
      speedInterval = setInterval(checkSpeed, 100);
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

  const updateLocationInfo = () => {
    const topOfContentArea = offset(nodeEl).top;
    let fragmentSelector = currentTextInfo?.fragmentSelector ?? null;
    let newLocationInfo = null;

    if (!fragmentSelector || fragmentSelector === '') {
      const textType = currentTextInfo?.type?.toLowerCase() ?? 'bible';
      switch (textType) {
        case 'videobible':
        case 'deafbible':
        case 'bible':
        case 'commentary':
          fragmentSelector = '.verse, .v';
          break;
        case 'book':
          fragmentSelector = '.page';
          break;
        default:
          fragmentSelector = '.verse, .v';
      }
    }

    let fragments = nodeEl.querySelectorAll(fragmentSelector);
    if (fragments.length === 1) {
      fragments = nodeEl.querySelectorAll('.section');
    }

    for (const fragment of fragments) {
      let currentFragment = fragment;
      let isFirstVisibleFragment = false;

      if (offset(currentFragment).top - topOfContentArea > -2) {
        isFirstVisibleFragment = true;
        const fragmentid = currentFragment.getAttribute('data-id');
        const totalFragments = currentFragment.parentNode?.querySelectorAll(`.${fragmentid}`) ?? [];

        if (totalFragments.length > 1) {
          currentFragment = totalFragments[0];
          if (offset(currentFragment).top - topOfContentArea <= -2) {
            isFirstVisibleFragment = false;
          }
        }
      }

      if (isFirstVisibleFragment) {
        const fragmentid = currentFragment.getAttribute('data-id');
        let label = '';
        let labelLong = '';
        const textType = currentTextInfo?.type?.toLowerCase() ?? 'bible';

        switch (textType) {
          case 'videobible':
          case 'deafbible':
          case 'bible':
          case 'commentary': {
            const bibleref = Reference(fragmentid);
            if (bibleref && currentTextInfo) {
              bibleref.language = currentTextInfo.lang;
              label = bibleref.toString();
              labelLong = `${label} (${currentTextInfo.abbr})`;
            }
            break;
          }
          case 'book':
            if (currentTextInfo) {
              labelLong = label = `${currentTextInfo.name} ${fragmentid}`;
            }
            break;
        }

        const closestSection = closest(currentFragment, '.section');
        newLocationInfo = {
          fragmentid: currentFragment.getAttribute('data-id'),
          sectionid: currentFragment.classList.contains('section')
            ? currentFragment.getAttribute('data-id')
            : (closestSection?.getAttribute('data-id') ?? ''),
          offset: topOfContentArea - offset(currentFragment).top,
          label,
          labelLong,
          textid: currentTextInfo?.id ?? ''
        };
        break;
      }
    }

    if (newLocationInfo != null && (locationInfo == null || newLocationInfo.fragmentid !== locationInfo.fragmentid)) {
      ext.trigger('locationchange', { type: 'locationchange', target: this, data: newLocationInfo });
    }

    locationInfo = newLocationInfo;
  };

  const loadMore = () => {
    if (!wrapper) return;

    const wrapperHeight = wrapper.offsetHeight;
    const nodeHeight = nodeEl.offsetHeight;
    const nodeScrolltop = nodeEl.scrollTop;
    const aboveTop = nodeScrolltop;
    const sections = wrapper.querySelectorAll('.section');
    const sectionsCount = sections.length;
    const belowBottom = wrapperHeight - nodeHeight - nodeScrolltop;

    if (speedDelta === 0) {
      if (belowBottom < nodeHeight * 2) {
        const lastSection = sections[sections.length - 1];
        const fragmentid = lastSection?.getAttribute('data-nextid') ?? null;

        if (fragmentid != null && fragmentid !== 'null' && sections.length < 50) {
          load('next', fragmentid);
        }
      }
      else if (aboveTop < nodeHeight * 2) {
        const firstSection = sections[0];
        const fragmentid = firstSection?.getAttribute('data-previd') ?? null;

        if (fragmentid != null && fragmentid !== 'null' && sections.length < 50) {
          load('prev', fragmentid);
        }
      }
      else if (aboveTop > nodeHeight * 15) {
        if (wrapper.children.length >= 2) {
          const secondSection = wrapper.querySelectorAll('.section')[1];
          const firstNodeOfSecondSection = secondSection?.firstElementChild ?? null;
          const firstNodeOffsetBefore = firstNodeOfSecondSection ? offset(firstNodeOfSecondSection).top : 0;

          const firstSection = wrapper.querySelector('.section');
          if (firstSection) firstSection.parentNode.removeChild(firstSection);

          // Maintain scroll position after removal
          const firstNodeOffsetAfter = firstNodeOfSecondSection ? offset(firstNodeOfSecondSection).top : 0;
          const offsetDifference = firstNodeOffsetAfter - firstNodeOffsetBefore;
          const newScrolltop = nodeEl.scrollTop;
          const updatedScrolltop = newScrolltop - Math.abs(offsetDifference);

          nodeEl.scrollTop = updatedScrolltop;
        }
      }
      else if (sectionsCount > 4 && belowBottom > nodeHeight * 15) {
        const lastSection = wrapper.querySelector('.section:last-child');
        if (lastSection) lastSection.parentNode.removeChild(lastSection);
      }
    }
  };

  const load = (loadType, sectionid, fragmentid) => {
    if (sectionid === 'null' || sectionid === null || sectionid === '') return;
    if (!wrapper) return;

    // Check if already loaded
    if (wrapper.querySelector(`.${sectionid}`)) {
      if (fragmentid?.trim() !== '' && wrapper.querySelector(`.${fragmentid}`)) {
        scrollTo(fragmentid);
      }
      return;
    }

    if (loadType === 'text') {
      wrapper.innerHTML = `<div class="loading-indicator" style="height:${nodeEl.offsetHeight}px;"></div>`;
      nodeEl.scrollTop = 0;
    }

    loadSection(currentTextInfo, sectionid, (content) => {
      if (!wrapper) return;

      if (wrapper.querySelector(`.${sectionid}`)) {
        if (fragmentid?.trim() !== '' && wrapper.querySelector(`.${fragmentid}`)) {
          scrollTo(fragmentid);
        }
        return;
      }

      ignoreScrollEvent = true;

      switch (loadType) {
        default:
        case 'text':
          wrapper.innerHTML = '';
          nodeEl.scrollTop = 0;

          if (typeof content === 'string') {
            wrapper.innerHTML = content;
          } else {
            const contentEl = toElement(content);
            if (contentEl) wrapper.appendChild(contentEl);
          }

          if (fragmentid) {
            scrollTo(fragmentid);
          }

          locationInfo = null;
          updateLocationInfo();
          break;

        case 'next':
          if (typeof content === 'string') {
            wrapper.insertAdjacentHTML('beforeend', content);
          } else {
            const contentEl = toElement(content);
            if (contentEl) wrapper.appendChild(contentEl);
          }
          break;

        case 'prev': {
          const nodeScrolltopBefore = nodeEl.scrollTop;
          const wrapperHeightBefore = wrapper.offsetHeight;

          if (typeof content === 'string') {
            wrapper.insertAdjacentHTML('afterbegin', content);
          } else {
            const contentEl = toElement(content);
            if (contentEl) wrapper.insertBefore(contentEl, wrapper.firstChild);
          }

          // Maintain scroll position after prepending content
          const wrapperHeightAfter = wrapper.offsetHeight;
          const heightDifference = wrapperHeightAfter - wrapperHeightBefore;
          nodeEl.scrollTop = nodeScrolltopBefore + heightDifference;
          break;
        }
      }

      ignoreScrollEvent = false;

      if (currentTextInfo) {
        ext.trigger('globalmessage', {
          type: 'globalmessage',
          target: this,
          data: {
            messagetype: 'textload',
            texttype: currentTextInfo.type?.toLowerCase() ?? 'bible',
            type: currentTextInfo.type?.toLowerCase() ?? 'bible',
            textid: currentTextInfo.id,
            abbr: currentTextInfo.abbr,
            sectionid,
            fragmentid,
            content
          }
        });
      }

      loadMore();
    });
  };

  const scrollTo = (fragmentid, scrollOffset) => {
    if (typeof fragmentid === 'undefined' || !wrapper) return;

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
        styleLink = createElements(`<link id="${styleId}" rel="stylesheet" href="${config.baseContentUrl}content/texts/${textinfo.id}/${textinfo.stylesheet}" />`);
        document.head.appendChild(styleLink);
      }
    }

    currentTextInfo = textinfo;
  };

  const getLocationInfo = () => locationInfo;

  const setFocus = () => {
  };

  const close = () => {
    nodeEl.removeEventListener('scroll', handleScroll, false);
    stopSpeedTest();

    if (globalTimeout != null) {
      clearTimeout(globalTimeout);
      globalTimeout = null;
    }

    if (speedIndicator.parentNode) {
      speedIndicator.parentNode.removeChild(speedIndicator);
    }

    ext.clearListeners();
  };

  let ext = {
    load_more: loadMore,
    loadMore,
    load,
    size,
    getTextInfo,
    setTextInfo,
    getLocationInfo,
    scrollTo,
    setFocus,
    close
  };

  ext = deepMerge(ext, EventEmitterMixin);
  ext._events = {};

  return ext;
}

export default Scroller;
