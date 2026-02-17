/**
 * VerseNavigator
 * A dropdown for navigating Bible books, chapters, and verses
 * Extends the TextNavigator pattern with a third verse-selection level
 * Uses native popover API for click-off detection
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { i18n } from '../lib/i18n.js';
import { BOOK_DATA, OT_BOOKS, NT_BOOKS, addNames, numbers as bibleNumbers, getVerseCount } from '../bible/BibleData.js';
import { Reference } from '../bible/BibleReference.js';

/**
 * Create a verse navigator (Book > Chapter > Verse)
 * @returns {Object} VerseNavigator API object
 */
export function VerseNavigator() {
	let target = null;
	let textInfo = null;
	let fullBookMode = false;

	const title = elem('span', { className: 'text-navigator-title', innerHTML: '&nbsp;' });
	const header = elem('div', { className: 'text-navigator-header' }, title);
	const divisions = elem('div', { className: 'text-navigator-divisions' });
	const changer = elem('div', { className: 'text-navigator verse-navigator nav-drop-list', popover: '' }, header, divisions);

	document.body.appendChild(changer);

	function hide() {
		changer.hidePopover();
	}

	function toggle() {
		if (changer.matches(':popover-open')) {
			hide();
		} else {
			show();
		}
	}

	function applyDivisionAttrs(divsEl) {
		if (!divsEl) return;
		divsEl.style.display = '';
		if (textInfo.dir) divsEl.setAttribute('dir', textInfo.dir);
		if (textInfo.lang) divsEl.setAttribute('lang', textInfo.lang);
	}

	function selectCurrentReference(fragmentid) {
		if (!fragmentid) return;
		const sectionid = fragmentid.split('_')[0];
		const divisionid = sectionid.substring(0, 2);
		const divisionNode = changer.querySelector('.divisionid-' + divisionid);
		if (!divisionNode) return;

		divisionNode.classList.add('selected');
		const divsContainer = changer.querySelector('.text-navigator-divisions');
		if (divsContainer) divsContainer.scrollTop = divisionNode.offsetTop - 40;

		renderSections(false);
		const sectionNode = divisionNode.querySelector('.section-' + sectionid);
		if (sectionNode) sectionNode.classList.add('selected');
	}

	function showBibleNav() {
		const textInputValue = target?.value ?? '';
		const biblereference = Reference(textInputValue);
		const fragmentid = biblereference ? biblereference.toSection() : null;

		renderDivisions();
		applyDivisionAttrs(changer.querySelector('.text-navigator-divisions'));
		selectCurrentReference(fragmentid);
	}

	function show() {
		if (textInfo == null) {
			console.warn('verse navigator has no textInfo!');
			return;
		}

		title.innerHTML = textInfo.name;
		size();
		changer.showPopover();
		size();

		changer.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
		const divs = changer.querySelector('.text-navigator-divisions');
		if (divs) divs.scrollTop = 0;

		showBibleNav();
	}

	function getBookSectionClass(bookid) {
		return BOOK_DATA[bookid] ? BOOK_DATA[bookid].section : '';
	}

	function getDisplayName(divisionName, divisionAbbr) {
		if (fullBookMode) return divisionName;
		const source = divisionAbbr ?? divisionName ?? '';
		return source.replace(/\s/i, '').substring(0, 3);
	}

	function buildDivisionElement(divisionid, divisionName, displayName) {
		const chapters = textInfo.sections.filter(c => c.substring(0, 2) === divisionid);
		return elem('div', {
			className: `text-navigator-division divisionid-${divisionid} division-section-${getBookSectionClass(divisionid)}`,
			dataset: { id: divisionid, chapters: chapters.join(','), name: divisionName }
		}, elem('span', displayName));
	}

	function renderDivisions() {
		const fragment = document.createDocumentFragment();
		const printed = { ot: false, nt: false };
		fullBookMode = true;

		const divsEl = changer.querySelector('.text-navigator-divisions');
		if (divsEl) divsEl.classList.toggle('text-navigator-divisions-full', fullBookMode);

		for (let i = 0; i < textInfo.divisions.length; i++) {
			const divisionid = textInfo.divisions[i];
			if (!BOOK_DATA[divisionid]) continue;

			const divisionName = textInfo.divisionNames?.[i] ?? null;
			const divisionAbbr = textInfo.divisionAbbreviations?.[i] ?? null;

			if (OT_BOOKS.includes(divisionid) && !printed.ot) {
				fragment.appendChild(elem('div', { className: 'text-navigator-division-header', textContent: i18n.t('windows.bible.ot') }));
				printed.ot = true;
			}
			if (NT_BOOKS.includes(divisionid) && !printed.nt) {
				fragment.appendChild(elem('div', { className: 'text-navigator-division-header', textContent: i18n.t('windows.bible.nt') }));
				printed.nt = true;
			}

			fragment.appendChild(buildDivisionElement(divisionid, divisionName, getDisplayName(divisionName, divisionAbbr)));
		}

		if (divsEl) {
			divsEl.innerHTML = '';
			divsEl.appendChild(fragment);
			divsEl.style.display = '';
		}

		changer.querySelectorAll('.text-navigator-sections').forEach(el => el.remove());
	}

	// Click a division (Bible book)
	changer.addEventListener('click', (e) => {
		const divisionNode = e.target.closest('.text-navigator-division');
		if (!divisionNode) return;

		// Don't handle if clicking on a chapter or verse tile inside
		if (e.target.closest('.text-navigator-section') || e.target.closest('.verse-navigator-verse')) return;

		if (divisionNode.classList.contains('selected')) {
			const sectionsEl = divisionNode.querySelector('.text-navigator-sections');
			if (sectionsEl) {
				sectionsEl.classList.add('collapsed');
				sectionsEl.addEventListener('transitionend', () => {
					divisionNode.classList.remove('selected');
				}, { once: true });
			} else {
				divisionNode.classList.remove('selected');
			}
			return;
		}

		divisionNode.classList.add('selected');
		[...divisionNode.parentElement.children].filter(s => s !== divisionNode).forEach(sib => sib.classList.remove('selected'));

		const divsEl = changer.querySelector('.text-navigator-divisions');
		const positionBefore = divisionNode.offsetTop;
		const scrollTopBefore = divsEl ? divsEl.scrollTop : 0;

		changer.querySelectorAll('.text-navigator-sections').forEach(el => el.parentNode.removeChild(el));

		const positionAfter = divisionNode.offsetTop;

		if (positionBefore > positionAfter && divsEl) {
			const newScrollTop = scrollTopBefore - (positionBefore - positionAfter);
			divsEl.scrollTop = newScrollTop;
		}

		renderSections(true);
	});

	function buildChapterElements(chapters) {
		const numbers = textInfo.numbers ?? bibleNumbers.default;
		const fragment = document.createDocumentFragment();
		for (const code of chapters) {
			const num = parseInt(code.substring(2));
			const span = elem('span', {
				className: `text-navigator-section section-${code}`,
				textContent: numbers[num],
				dataset: { id: code }
			});
			fragment.appendChild(span);
		}
		return fragment;
	}

	function insertSectionNodes(selectedDiv, sectionNodes, animated) {
		const spanEl = selectedDiv?.querySelector('span');
		if (spanEl) spanEl.parentNode.insertBefore(sectionNodes, spanEl.nextSibling);

		const isLast = selectedDiv && !selectedDiv.nextElementSibling;
		if (animated && !isLast) {
			sectionNodes.offsetHeight;
			sectionNodes.classList.remove('collapsed');
		} else {
			sectionNodes.classList.remove('collapsed');
			if (isLast) {
				const divisionsEl = changer.querySelector('.text-navigator-divisions');
				if (divisionsEl) divisionsEl.scrollTop += 500;
			}
		}
	}

	function renderBibleSections(animated) {
		const selectedDiv = changer.querySelector('.text-navigator-division.selected');
		const divisionname = selectedDiv?.getAttribute('data-name') ?? null;
		const chapters = selectedDiv?.getAttribute('data-chapters')?.split(',') ?? [];

		title.textContent = divisionname;
		const inner = elem('div', { className: 'text-navigator-sections-inner' });
		inner.appendChild(buildChapterElements(chapters));
		const sectionNodes = elem('div', { className: 'text-navigator-sections collapsed' });
		sectionNodes.appendChild(inner);
		insertSectionNodes(selectedDiv, sectionNodes, animated);
	}

	function renderSections(animated) {
		renderBibleSections(animated);
	}

	// Click a chapter — show verse grid instead of firing change
	changer.addEventListener('click', (e) => {
		const el = e.target.closest('.text-navigator-section');
		if (!el) return;

		const inner = el.closest('.text-navigator-sections-inner');

		// If already selected, collapse the verse grid
		if (el.classList.contains('selected')) {
			const verseGrid = inner?.querySelector('.verse-navigator-verses');
			if (verseGrid) {
				verseGrid.classList.add('collapsed');
				verseGrid.addEventListener('transitionend', () => {
					verseGrid.remove();
					el.classList.remove('selected');
					inner?.classList.remove('has-verse-selection');
				}, { once: true });
			} else {
				el.classList.remove('selected');
				inner?.classList.remove('has-verse-selection');
			}
			return;
		}

		// Deselect other chapters and remove existing verse grids
		inner?.querySelectorAll('.text-navigator-section.selected').forEach(s => s.classList.remove('selected'));
		inner?.querySelectorAll('.verse-navigator-verses').forEach(v => v.remove());

		el.classList.add('selected');
		inner?.classList.add('has-verse-selection');

		const sectionid = el.getAttribute('data-id');
		const bookid = sectionid.substring(0, 2);
		const chapter = parseInt(sectionid.substring(2));
		const verseCount = getVerseCount(bookid, chapter);

		if (!verseCount) {
			// Fallback: fire change with just sectionid (no verse)
			ext.trigger('change', { type: 'change', target: el, data: { sectionid, fragmentid: sectionid, target } });
			hide();
			return;
		}

		// Build verse grid
		const numbers = textInfo.numbers ?? bibleNumbers.default;
		const verseInner = elem('div', { className: 'verse-navigator-verses-inner' });
		for (let v = 1; v <= verseCount; v++) {
			verseInner.appendChild(elem('span', {
				className: 'verse-navigator-verse',
				textContent: numbers[v] ?? v,
				dataset: { sectionid, verse: String(v) }
			}));
		}

		const verseGrid = elem('div', { className: 'verse-navigator-verses collapsed' }, verseInner);

		// Insert right after the selected chapter span
		el.insertAdjacentElement('afterend', verseGrid);
		// Force reflow then animate in
		verseGrid.offsetHeight;
		verseGrid.classList.remove('collapsed');

		// Update title
		const divisionNode = el.closest('.text-navigator-division');
		const divisionName = divisionNode?.getAttribute('data-name') ?? '';
		title.textContent = `${divisionName} ${numbers[chapter] ?? chapter}`;
	});

	// Click a verse — fire change and hide
	changer.addEventListener('click', (e) => {
		const el = e.target.closest('.verse-navigator-verse');
		if (!el) return;

		const sectionid = el.dataset.sectionid;
		const verse = el.dataset.verse;
		const fragmentid = sectionid + '_' + verse;

		ext.trigger('change', { type: 'change', target: el, data: { sectionid, fragmentid, verse, target } });
		hide();
	});

	function size(width, height) {
		if (target == null) return;

		const targetOffset = offset(target);
		const targetOuterHeight = target.offsetHeight;
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
		changer.style.setProperty('--arrow-left', upArrowLeft + 'px');

		const headerHeight = header.offsetHeight;
		changer.querySelectorAll('.text-navigator-divisions, .text-navigator-sections').forEach(el => {
			el.style.height = (maxHeight - headerHeight) + 'px';
		});
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

	mixinEventEmitter(ext);
	ext._events = {};

	return ext;
}

let globalVerseNavigator = null;

export function getGlobalVerseNavigator() {
	if (!globalVerseNavigator) {
		globalVerseNavigator = VerseNavigator();
	}
	return globalVerseNavigator;
}

export default VerseNavigator;
