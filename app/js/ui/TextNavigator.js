/**
 * TextNavigator
 * A dropdown for navigating Bible books and chapters
 * Uses native popover API for click-off detection
 */

import { createElements, on, siblings, offset, slideDown, slideUp, deepMerge, toElement } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';
const hasTouch = 'ontouchend' in document;
import { i18n } from '../lib/i18n.js';
import { BOOK_DATA, OT_BOOKS, NT_BOOKS, addNames, numbers as bibleNumbers } from '../bible/BibleData.js';
import { Reference } from '../bible/BibleReference.js';

/**
 * Create a text navigator
 * @returns {Object} TextNavigator API object
 */
export function TextNavigator() {
  let container = null;
  let target = null;
  let isFull = false;
  let textInfo = null;
  let fullBookMode = false;

  const changer = createElements(
    '<div class="text-navigator nav-drop-list" popover>' +
      '<span class="up-arrow"></span>' +
      '<span class="up-arrow-border"></span>' +
      '<div class="text-navigator-header">' +
        '<span class="text-navigator-title">&nbsp;</span>' +
        '<span class="text-navigator-back">Back</span>' +
        '<span class="text-navigator-close">Close</span>' +
      '</div>' +
      '<div class="text-navigator-divisions"></div>' +
    '</div>'
  );

  const header = changer.querySelector('.text-navigator-header');
  const title = changer.querySelector('.text-navigator-title');
  const back = changer.querySelector('.text-navigator-back');
  const closeBtn = changer.querySelector('.text-navigator-close');
  const fullname = createElements('<div class="text-navigator-fullname"></div>');

  document.body.appendChild(changer);

  back.style.display = 'none';
  closeBtn.style.display = 'none';

  // Handle popover toggle events (fires on light dismiss - click outside or Escape)
  changer.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') {
      fullname.style.display = 'none';
    }
  });

  document.body.appendChild(fullname);
  fullname.style.display = 'none';

  if (!hasTouch) {
    on(changer, 'mouseover', '.text-navigator-division', function() {
      if (!fullBookMode) {
        const node = this;
        const name = node.getAttribute('data-name');
        const nodeOffset = offset(node);

        fullname.innerHTML = name;
        fullname.style.backgroundColor = getComputedStyle(node).backgroundColor;
        fullname.style.top = (nodeOffset.top - 1) + 'px';
        fullname.style.left = nodeOffset.left + 'px';
        fullname.style.display = '';
        fullname.lastNode = node;
      }
    });

    on(changer, 'mouseout', '.text-navigator-division', function() {
      fullname.style.display = 'none';
    });
  }

  fullname.addEventListener('click', function() {
    if (fullname.lastNode) {
      fullname.lastNode.click();
      fullname.style.display = 'none';
    }
  }, false);

  closeBtn.addEventListener('click', function() {
    hide();
  }, false);

  function hide() {
    changer.hidePopover();
    fullname.style.display = 'none';
  }

  function toggle() {
    if (changer.matches(':popover-open')) {
      hide();
    } else {
      show();
    }
  }

  function show() {
    if (textInfo == null) {
      console.warn('navigator has no textInfo!');
      return;
    }

    title.innerHTML = textInfo.name;
    size();
    changer.showPopover();
    size();

    changer.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    const divisions = changer.querySelector('.text-navigator-divisions');
    if (divisions) divisions.scrollTop = 0;

    const textType = textInfo.type ? textInfo.type.toLowerCase() : 'bible';

    switch (textType) {
      case 'bible':
      case 'deafbible':
      case 'videobible':
      case 'commentary':
        const targetEl = toElement(target);
        const textInputValue = targetEl?.value ?? '';
        const biblereference = Reference(textInputValue);
        const fragmentid = biblereference ? biblereference.toSection() : null;

        renderDivisions();
        let divsEl = changer.querySelector('.text-navigator-divisions');
        if (divsEl) {
          divsEl.style.display = '';
          if (textInfo.dir) divsEl.setAttribute('dir', textInfo.dir);
          if (textInfo.lang) divsEl.setAttribute('lang', textInfo.lang);
        }

        if (fragmentid) {
          const parts = fragmentid.split('_');
          const sectionid = parts[0];
          const divisionid = sectionid.substring(0, 2);

          const divisionNode = changer.querySelector('.divisionid-' + divisionid);
          if (divisionNode) {
            divisionNode.classList.add('selected');
            const offsetVal = divisionNode.offsetTop;
            const divsContainer = changer.querySelector('.text-navigator-divisions');
            if (divsContainer) divsContainer.scrollTop = offsetVal - 40;

            renderSections(false);

            const sectionNode = divisionNode.querySelector('.section-' + sectionid);
            if (sectionNode) sectionNode.classList.add('selected');
          }
        }
        break;

      case 'book':
        renderSections();
        divsEl = changer.querySelector('.text-navigator-divisions');
        if (divsEl) divsEl.style.display = 'none';
        break;
    }
  }

  function getBookSectionClass(bookid) {
    return BOOK_DATA[bookid] ? BOOK_DATA[bookid].section : '';
  }

  function renderDivisions() {
    const html = [];
    let hasPrintedOt = false;
    let hasPrintedNt = false;

    fullBookMode = true;

    let divsEl = changer.querySelector('.text-navigator-divisions');
    if (fullBookMode) {
      if (divsEl) divsEl.classList.add('text-navigator-divisions-full');
    } else {
      if (divsEl) divsEl.classList.remove('text-navigator-divisions-full');
    }

    for (let i = 0, il = textInfo.divisions.length; i < il; i++) {
      const divisionid = textInfo.divisions[i];
      const divisionName = textInfo.divisionNames ? textInfo.divisionNames[i] : null;
      const divisionAbbr = textInfo.divisionAbbreviations ? textInfo.divisionAbbreviations[i] : null;
      const displayName = fullBookMode ? divisionName :
        (divisionAbbr != null ? divisionAbbr.replace(/\s/i, '').substring(0, 3) :
          (divisionName ? divisionName.replace(/\s/i, '').substring(0, 3) : ''));
      const book = BOOK_DATA[divisionid];

      if (typeof book === 'undefined') continue;

      if (OT_BOOKS.indexOf(divisionid) > -1 && !hasPrintedOt) {
        html.push('<div class="text-navigator-division-header">' + i18n.t('windows.bible.ot') + '</div>');
        hasPrintedOt = true;
      }
      if (NT_BOOKS.indexOf(divisionid) > -1 && !hasPrintedNt) {
        html.push('<div class="text-navigator-division-header">' + i18n.t('windows.bible.nt') + '</div>');
        hasPrintedNt = true;
      }

      const chapters = textInfo.sections.filter(c => c.substring(0, 2) === divisionid);

      html.push('<div class="text-navigator-division divisionid-' + divisionid +
        ' division-section-' + getBookSectionClass(divisionid) +
        '" data-id="' + divisionid +
        '" data-chapters="' + chapters.join(',') +
        '" data-name="' + divisionName + '"><span>' + displayName + '</span></div>');
    }

    if (divsEl) {
      divsEl.innerHTML = html.join('');
      divsEl.style.display = '';
    }

    const existingSections = changer.querySelectorAll('.text-navigator-sections');
    existingSections.forEach(el => el.parentNode.removeChild(el));
  }

  // Click a division (Bible book)
  on(changer, 'click', '.text-navigator-division', function() {
    const divisionNode = this;

    if (divisionNode.classList.contains('selected')) {
      const sectionsEl = divisionNode.querySelector('.text-navigator-sections');
      if (sectionsEl) {
        slideUp(sectionsEl, function() {
          divisionNode.classList.remove('selected');
        });
      } else {
        divisionNode.classList.remove('selected');
      }
      return;
    }

    divisionNode.classList.add('selected');
    siblings(divisionNode).forEach(sib => sib.classList.remove('selected'));

    fullname.style.display = 'none';

    const divisions = changer.querySelector('.text-navigator-divisions');
    const positionBefore = divisionNode.offsetTop;
    const scrollTopBefore = divisions ? divisions.scrollTop : 0;

    changer.querySelectorAll('.text-navigator-sections').forEach(el => el.parentNode.removeChild(el));

    const positionAfter = divisionNode.offsetTop;

    if (positionBefore > positionAfter && divisions) {
      const newScrollTop = scrollTopBefore - (positionBefore - positionAfter);
      divisions.scrollTop = newScrollTop;
    }

    renderSections(true);
  });

  function renderSections(animated) {
    const html = [];
    const textType = textInfo.type ? textInfo.type.toLowerCase() : 'bible';

    switch (textType) {
      case 'bible':
      case 'deafbible':
      case 'videobible':
      case 'commentary':
        const selected_division = changer.querySelector('.text-navigator-division.selected');
        const isLast = selected_division ? !selected_division.nextElementSibling : false;
        const divisionname = selected_division ? selected_division.getAttribute('data-name') : null;
        const chapters = selected_division ? selected_division.getAttribute('data-chapters').split(',') : [];
        const numbers = typeof textInfo.numbers !== 'undefined' ? textInfo.numbers : bibleNumbers.default;

        title.innerHTML = divisionname;

        for (let chapter = 0; chapter < chapters.length; chapter++) {
          const dbsChapterCode = chapters[chapter];
          const chapterNumber = parseInt(dbsChapterCode.substring(2));
          html.push('<span class="text-navigator-section section-' + dbsChapterCode +
            '" data-id="' + dbsChapterCode + '">' + numbers[chapterNumber].toString() + '</span>');
        }

        const sectionNodes = createElements('<div class="text-navigator-sections" style="display:none;">' + html.join('') + '</div>');

        if (selected_division) {
          const spanEl = selected_division.querySelector('span');
          if (spanEl) {
            spanEl.parentNode.insertBefore(sectionNodes, spanEl.nextSibling);
          }
        }

        if (animated === true && !isLast) {
          slideDown(sectionNodes);
        } else {
          sectionNodes.style.display = '';
          if (isLast) {
            const divisionsEl = changer.querySelector('.text-navigator-divisions');
            if (divisionsEl) divisionsEl.scrollTop = divisionsEl.scrollTop + 500;
          }
        }
        break;

      case 'book':
        for (let i = 0, il = textInfo.sections.length; i < il; i++) {
          const sectionid = textInfo.sections[i];
          html.push('<span class="text-navigator-section" data-id="' + sectionid + '">' + sectionid.replace('P', '') + '</span>');
        }
        break;
    }
  }

  on(changer, 'click', '.text-navigator-section', function() {
    const el = this;
    el.classList.add('selected');
    const sectionid = el.getAttribute('data-id');

    ext.trigger('change', { type: 'change', target: el, data: { sectionid: sectionid, target: target } });
    hide();
  });

  function size(width, height) {
    if (isFull) {
      const containerEl = toElement(container);
      if (!(width && height)) {
        width = containerEl.offsetWidth;
        height = containerEl.offsetHeight;
      }

      const containerOffset = offset(containerEl);

      changer.style.width = width + 'px';
      changer.style.height = height + 'px';
      changer.style.top = containerOffset.top + 'px';
      changer.style.left = containerOffset.left + 'px';
    } else {
      if (target == null) return;

      const targetEl = toElement(target);
      const targetOffset = offset(targetEl);
      const targetOuterHeight = targetEl.offsetHeight;
      const top = targetOffset.top + targetOuterHeight + 10;
      const changerWidth = changer.offsetWidth;
      const winHeight = window.innerHeight - 40;
      const winWidth = window.innerWidth;
      const maxHeight = winHeight - top;

      let left = targetOffset.left;

      if (winWidth < left + changerWidth) {
        left = winWidth - changerWidth;
        if (left < 0) left = 0;
      }

      changer.style.height = maxHeight + 'px';
      changer.style.top = top + 'px';
      changer.style.left = left + 'px';

      const upArrowLeft = targetOffset.left - left + 20;
      changer.querySelectorAll('.up-arrow, .up-arrow-border').forEach(arrow => {
        arrow.style.left = upArrowLeft + 'px';
      });

      const headerHeight = header.offsetHeight;
      changer.querySelectorAll('.text-navigator-divisions, .text-navigator-sections').forEach(el => {
        el.style.height = (maxHeight - headerHeight) + 'px';
      });
    }
  }

  function setTextInfo(value) {
    textInfo = value;

    if (textInfo.title) {
      changer.querySelector('.text-navigator-header').innerHTML = textInfo.title;
    }

    if (textInfo.divisionNames) {
      addNames(textInfo.lang, textInfo.divisions, textInfo.divisionNames);
    }
  }

  function isVisible() {
    return changer.matches(':popover-open');
  }

  function node() {
    return changer;
  }

  function close() {
    hide();
  }

  function setTarget(_container, _target) {
    container = _container;
    target = _target;
  }

  function getTarget() {
    return target;
  }

  let ext = {
    setTarget,
    getTarget,
    show,
    toggle,
    hide,
    isVisible,
    node,
    setTextInfo,
    size,
    close
  };

  ext = deepMerge(ext, EventEmitterMixin);
  ext._events = {};

  return ext;
}

let globalTextNavigator = null;

export function getGlobalTextNavigator() {
  if (!globalTextNavigator) {
    globalTextNavigator = TextNavigator();
  }
  return globalTextNavigator;
}

export default TextNavigator;
