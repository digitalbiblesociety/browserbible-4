/**
 * VisualFilters
 * Highlights words based on morphological data (Strong's numbers, Greek/Hebrew morphology)
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import morphologySvg from '../../css/images/morphology.svg?raw';

/**
 * Convert hyphenated CSS property names to camelCase
 * e.g., "background-color" -> "backgroundColor"
 */
const toCamelCase = (str) => {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
};

/**
 * Apply style to a DOM element
 */
const applyStyle = (node, css) => {
  if (css === undefined || css == null || css === '') return;

  const el = node;
  const props = css.split(';');

  for (const prop of props) {
    const parts = prop.split(':');
    if (parts.length === 2) {
      const propertyName = toCamelCase(parts[0].trim());
      el.style[propertyName] = parts[1].trim();
    }
  }
};

/**
 * Check if a word matches a transform's criteria
 */
const matchesTransform = (word, transform) => {
  if (!transform.active) return false;

  // Strong's number check
  if (transform.strongs !== '') {
    if (word.getAttribute('s') !== transform.strongs) return false;
  }

  // Morphology check
  if (transform.morph !== '' && transform.morphRegExp?.test) {
    const wordMorphData = word.getAttribute('m');
    if (wordMorphData == null || !transform.morphRegExp.test(wordMorphData)) return false;
  }

  // Must have at least one filter criteria
  return transform.strongs !== '' || transform.morph !== '';
};

/**
 * Visual Transformer - applies style transforms to text
 */
const VisualTransformer = {
  resetTransforms(visualSettings) {
    document.querySelectorAll('l').forEach(el => {
      el.setAttribute('style', '');
    });

    document.querySelectorAll('.section').forEach(section => {
      VisualTransformer.runTransforms(section, visualSettings);
    });
  },

  runTransforms(sectionNode, visualSettings) {
    if (visualSettings.transforms.length === 0) return;

    sectionNode.querySelectorAll('l').forEach(word => {
      for (const transform of visualSettings.transforms) {
        if (matchesTransform(word, transform)) {
          applyStyle(word, transform.style);
        }
      }
    });
  },

  applyStyle
};

/**
 * Build CSS string from style type and color
 */
const buildStyleCss = (styleType, color) => {
  switch (styleType) {
    case 'text':
      return `color: ${color};`;
    case 'background':
      return `background-color: ${color};`;
    case 'underline':
      return `border-bottom: solid 2px ${color};`;
    default:
      return `color: ${color};`;
  }
};

/**
 * Morphology Selector dropdown
 */
const MorphologySelector = () => {
  const robinsonElements = {
    nounCase: {
      breakBefore: true,
      declension: 'Case',
      parts: [
        { letter: 'N', type: 'Nominative' },
        { letter: 'A', type: 'Accusative' },
        { letter: 'D', type: 'Dative' },
        { letter: 'G', type: 'Genitive' },
        { letter: 'V', type: 'Vocative' }
      ]
    },
    number: {
      declension: 'Number',
      parts: [
        { letter: 'P', type: 'Plural' },
        { letter: 'S', type: 'Singular' }
      ]
    },
    gender: {
      declension: 'Gender',
      parts: [
        { letter: 'F', type: 'Feminine' },
        { letter: 'M', type: 'Masculine' },
        { letter: 'N', type: 'Neuter' }
      ]
    },
    verbTense: {
      breakBefore: true,
      declension: 'Tense',
      parts: [
        { letter: 'A', type: 'Aorist' },
        { letter: 'F', type: 'Future' },
        { letter: 'I', type: 'Imperfect' },
        { letter: 'R', type: 'Perfect' },
        { letter: 'L', type: 'Pluperfect' },
        { letter: 'P', type: 'Present' }
      ]
    },
    verbVoice: {
      declension: 'Voice',
      parts: [
        { letter: 'A', type: 'Active' },
        { letter: 'M', type: 'Middle' },
        { letter: 'P', type: 'Passive' }
      ]
    },
    verbMood: {
      declension: 'Mood',
      parts: [
        { letter: 'I', type: 'Indicative' },
        { letter: 'S', type: 'Subjunctive' },
        { letter: 'O', type: 'Optative' },
        { letter: 'M', type: 'Imperative' },
        { letter: 'N', type: 'Infinitive' },
        { letter: 'P', type: 'Participle' }
      ]
    },
    person: {
      declension: 'Person',
      breakBefore: true,
      parts: [
        { letter: '1', type: '1st Person' },
        { letter: '2', type: '2nd Person' },
        { letter: '3', type: '3rd Person' }
      ]
    }
  };

  const morphhbElements = {
    nounTypes: {
      declension: 'Type',
      parts: [
        { letter: 'c', type: 'Common' },
        { letter: 'g', type: 'Gentilic' },
        { letter: 'p', type: 'Proper name' }
      ]
    },
    person: {
      declension: 'Person',
      breakBefore: true,
      parts: [
        { letter: '1', type: '1st Person' },
        { letter: '2', type: '2nd Person' },
        { letter: '3', type: '3rd Person' }
      ]
    },
    number: {
      declension: 'Number',
      parts: [
        { letter: 'p', type: 'Plural' },
        { letter: 's', type: 'Singular' },
        { letter: 'd', type: 'Dual' }
      ]
    },
    state: {
      declension: 'State',
      parts: [
        { letter: 'a', type: 'Absolute' },
        { letter: 'c', type: 'Construct' },
        { letter: 'd', type: 'Determined' }
      ]
    },
    nounGender: {
      declension: 'Gender',
      parts: [
        { letter: 'f', type: 'Feminine' },
        { letter: 'm', type: 'Masculine' },
        { letter: 'b', type: 'Both' }
      ]
    },
    verbGender: {
      declension: 'Gender',
      parts: [
        { letter: 'f', type: 'Feminine' },
        { letter: 'm', type: 'Masculine' },
        { letter: 'c', type: 'Common' }
      ]
    },
    verbStem: {
      declension: 'Stem',
      parts: [
        { letter: 'q', type: 'qal' },
        { letter: 'N', type: 'niphal' },
        { letter: 'p', type: 'piel' },
        { letter: 'P', type: 'pual' },
        { letter: 'h', type: 'hiphil' },
        { letter: 'H', type: 'hophal' },
        { letter: 't', type: 'hithpael' }
      ]
    },
    verbType: {
      declension: 'Type',
      parts: [
        { letter: 'p', type: 'perfect (qatal)' },
        { letter: 'q', type: 'sequential perfect (weqatal)' },
        { letter: 'i', type: 'imperfect (yiqtol)' },
        { letter: 'w', type: 'sequential imperfect (wayyiqtol)' },
        { letter: 'v', type: 'imperative' },
        { letter: 'r', type: 'participle active' },
        { letter: 's', type: 'participle passive' },
        { letter: 'a', type: 'infinitive absolute' },
        { letter: 'c', type: 'infinitive construct' }
      ]
    }
  };

  const morphologies = {
    robinson: [
      {
        letter: 'N',
        type: 'Noun',
        declensions: [robinsonElements.nounCase, robinsonElements.number, robinsonElements.gender]
      },
      {
        letter: 'V',
        type: 'Verb',
        declensions: [robinsonElements.verbTense, robinsonElements.verbVoice, robinsonElements.verbMood, robinsonElements.person, robinsonElements.number]
      }
    ],
    morphhb: [
      {
        letter: 'N',
        type: 'Noun',
        declensions: [morphhbElements.nounTypes, morphhbElements.nounGender, morphhbElements.number, morphhbElements.state]
      },
      {
        letter: 'V',
        type: 'Verb',
        declensions: [morphhbElements.verbStem, morphhbElements.verbType, morphhbElements.person, morphhbElements.number, morphhbElements.verbGender, morphhbElements.state]
      }
    ]
  };

  let currentMorphologyKey = 'robinson';
  let currentMorphology = morphologies[currentMorphologyKey];

  const morphTh = elem('div', { className: 'morph-th', style: { gridRow: '1' } }, 'Part of Speech');
  const morphSelectorHeaderRow = elem('div', { className: 'morph-header-row', style: { display: 'contents' } }, morphTh);
  const morphSelectorMainRow = elem('div', { className: 'morph-main-row', style: { display: 'contents' } });
  const morphGrid = elem('div', { className: 'morph-grid', style: { display: 'grid', gridAutoColumns: 'auto', gridTemplateRows: 'auto auto' } }, morphSelectorHeaderRow, morphSelectorMainRow);
  const morphSelector = elem('div', { className: 'morph-selector' }, morphGrid);

  document.body.appendChild(morphSelector);
  morphSelector.style.display = 'none';
  const morphSelectorPOS = elem('div', { className: 'morph-pos morph-td', style: { gridRow: '2' } });
  morphSelectorMainRow.appendChild(morphSelectorPOS);

  // Define drawSelectedPartOfSpeech before drawPartsOfSpeech (which calls it)
  const drawSelectedPartOfSpeech = () => {
    const firstTh = morphSelectorHeaderRow.querySelector('.morph-th');
    [...firstTh.parentElement.children].filter(s => s !== firstTh).forEach(sibling => {
      sibling.parentNode.removeChild(sibling);
    });

    const firstTd = morphSelectorMainRow.querySelector('.morph-td');
    [...firstTd.parentElement.children].filter(s => s !== firstTd).forEach(sibling => {
      sibling.parentNode.removeChild(sibling);
    });

    const selectedSpan = morphSelectorPOS.querySelector('.selected');
    const selectedValue = selectedSpan?.getAttribute('data-value') ?? '';

    if (!selectedSpan) return;

    let partOfSpeech = null;
    for (const morph of currentMorphology) {
      if (morph.letter === selectedValue) {
        partOfSpeech = morph;
        break;
      }
    }

    if (!partOfSpeech) return;

    const row = selectedSpan.closest('.morph-main-row');
    for (const declension of partOfSpeech.declensions) {
      const th = elem('div', { className: 'morph-th', textContent: declension.declension, style: { gridRow: '1' } });
      const td = elem('div', { className: 'morph-td', style: { gridRow: '2' } });

      morphSelectorHeaderRow.appendChild(th);
      row.appendChild(td);

      for (const part of declension.parts) {
        const span = elem('span', {
          textContent: part.type,
          dataset: { value: part.letter, ...(declension.breakBefore && { breakbefore: 'true' }) }
        });
        td.appendChild(span);
      }
    }

    const grid = morphSelector.querySelector('.morph-grid');
    morphSelector.style.height = `${grid.offsetHeight}px`;
  };

  // Define drawPartsOfSpeech before setMorphology (which calls it)
  const drawPartsOfSpeech = () => {
    morphSelectorPOS.innerHTML = '';

    for (const morph of currentMorphology) {
      const span = elem('span', { dataset: { value: morph.letter } }, morph.type);
      morphSelectorPOS.appendChild(span);
    }

    drawSelectedPartOfSpeech();
  };

  const setMorphology = (value) => {
    // Only set morphology if it exists, default to 'robinson'
    currentMorphologyKey = morphologies[value] ? value : 'robinson';
    currentMorphology = morphologies[currentMorphologyKey];
    drawPartsOfSpeech();
  };

  const selectOnly = (span) => {
    span.classList.add('selected');
    [...span.parentElement.children].filter(s => s !== span).forEach(s => s.classList.remove('selected'));
  };

  const selectRemainderLetters = (remainder) => {
    const tds = morphSelectorMainRow.querySelectorAll('.morph-td');
    for (let i = 0; i < remainder.length; i++) {
      const td = tds[i + 1]; // Skip first (POS) cell
      const letterSpan = td?.querySelector(`span[data-value="${remainder[i]}"]`);
      if (letterSpan) letterSpan.classList.add('selected');
    }
  };

  const updateMorphSelector = (value) => {
    if (value.length === 0) {
      morphSelector.querySelectorAll('span').forEach(span => span.classList.remove('selected'));
      drawSelectedPartOfSpeech();
      return;
    }

    const partOfSpeechSpan = morphSelectorPOS.querySelector(`span[data-value="${value[0]}"]`);
    if (!partOfSpeechSpan) return;

    selectOnly(partOfSpeechSpan);
    drawSelectedPartOfSpeech();

    if (value.length > 1) {
      const remainder = value.substring(1).replace(/^-/, '');
      selectRemainderLetters(remainder);
    }
  };

  drawPartsOfSpeech();

  morphSelector.addEventListener('click', (e) => {
    const selectedSpan = e.target.closest('span');
    if (!selectedSpan) return;

    if (selectedSpan.classList.contains('selected')) {
      selectedSpan.classList.remove('selected');
    } else {
      selectedSpan.classList.add('selected');
      [...selectedSpan.parentElement.children].filter(s => s !== selectedSpan).forEach(sibling => {
        sibling.classList.remove('selected');
      });
    }

    const parentTd = selectedSpan.closest('.morph-td');
    if (parentTd?.classList.contains('morph-pos')) {
      drawSelectedPartOfSpeech();
    }

    let selector = '';
    let lastPartOfSpeechWithSelection = -1;

    const row = selectedSpan.closest('.morph-main-row');
    const tds = row.querySelectorAll('.morph-td');
    tds.forEach((td, index) => {
      const selectedDeclension = td.querySelector('span.selected');
      if (selectedDeclension) {
        lastPartOfSpeechWithSelection = index;
      }
    });

    tds.forEach((td, index) => {
      const selectedDeclension = td.querySelector('span.selected');
      const firstSpan = td.querySelector('span');
      const includeBreak = firstSpan?.getAttribute('data-breakbefore') === 'true';

      if (!selectedDeclension) {
        if (index <= lastPartOfSpeechWithSelection) {
          selector += `${includeBreak ? '-' : ''}?`;
        }
      } else {
        selector += `${includeBreak ? '-' : ''}${selectedDeclension.getAttribute('data-value')}`;
      }
    });

    if (morphSelector.currentInput != null) {
      morphSelector.currentInput.value = selector;
    }

    const updateEvent = new CustomEvent('update', { detail: selector });
    morphSelector.dispatchEvent(updateEvent);
  });

  morphSelector.updateMorphSelector = updateMorphSelector;
  morphSelector.setMorphology = setMorphology;
  morphSelector.currentInput = null;

  return morphSelector;
};

/**
 * Create Visual Filters plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export function VisualFilters(app) {
  const config = getConfig();

  if (!config.enableVisualFilters) {
    return {};
  }

  const settingsKey = 'docs-config-visualfilters';

  const filtersWindow = MovableWindow(580, 320);
  filtersWindow.hide();

  const defaultSettings = {
    transforms: [
      {
        active: false,
        strongs: 'G2424',
        morphType: '',
        morph: '',
        styleType: 'underline',
        styleColor: '#ff3333'
      },
      {
        active: false,
        strongs: '',
        morphType: 'robinson',
        morph: 'V-A',
        styleType: 'text',
        styleColor: '#3333cc'
      },
      {
        active: false,
        strongs: '',
        morphType: 'morphhb',
        morph: 'Np',
        styleType: 'text',
        styleColor: '#999999'
      }
    ]
  };

  const visualSettings = AppSettings.getValue(settingsKey, defaultSettings);

  const visualNode = elem('div', { id: 'visualfilters-config' });
  const addRowButton = elem('input', { type: 'button', value: 'New Filter' });
  const visualGrid = elem('div', {
    className: 'visualfilters-grid',
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr 1fr 1fr auto',
      gap: '4px 8px',
      alignItems: 'center'
    }
  });
  const thActive = elem('div', { className: 'visualfilters-active visualfilters-th' });
  const thStrongs = elem('div', { className: 'visualfilters-strongs visualfilters-th i18n', dataset: { i18n: '[html]plugins.visualfilters.strongsnumber' } }, "Strong's");
  const thMorph = elem('div', { className: 'visualfilters-morph visualfilters-th i18n', dataset: { i18n: '[html]plugins.visualfilters.morphology' } }, 'Morphology');
  const thStyle = elem('div', { className: 'visualfilters-style visualfilters-th i18n', dataset: { i18n: '[html]plugins.visualfilters.style' } }, 'Style');
  const thRemove = elem('div', { className: 'visualfilters-remove visualfilters-th' });
  visualGrid.append(thActive, thStrongs, thMorph, thStyle, thRemove);
  const tbody = visualGrid; // tbody is now the grid itself (rows added directly)
  visualNode.append(addRowButton, visualGrid);

  const filtersWindowBody = filtersWindow.body;
  filtersWindowBody.appendChild(visualNode);

  const morphSelector = MorphologySelector();

  const configToolsBody = document.querySelector('#config-tools .config-body');
  const openVisualizationsButton = elem('span', { className: 'config-button i18n', id: 'config-visualfilters-button', dataset: { i18n: '[html]plugins.visualfilters.button' } });
  const vfIconSpan = elem('span', { className: 'config-button-icon' });
  vfIconSpan.innerHTML = morphologySvg;
  openVisualizationsButton.prepend(vfIconSpan);

  if (configToolsBody) {
    configToolsBody.appendChild(openVisualizationsButton);
  }

  // Define createRow before it's used in drawTransforms and addRowButton click handler
  // Returns a document fragment containing 5 grid cells (one row)
  const createRow = () => {
    const fragment = document.createDocumentFragment();
    const tdActive = elem('div', { className: 'visualfilters-active visualfilters-cell' });
    tdActive.appendChild(elem('input', { type: 'checkbox', checked: true }));
    const tdStrongs = elem('div', { className: 'visualfilters-strongs visualfilters-cell' });
    tdStrongs.appendChild(elem('input', { type: 'text', placeholder: 'G2424, H234' }));
    const tdMorph = elem('div', { className: 'visualfilters-morph visualfilters-cell' });
    const morphSelect = elem('select');
    morphSelect.appendChild(elem('option', { value: 'morphhb', textContent: 'Hebrew' }));
    morphSelect.appendChild(elem('option', { value: 'robinson', textContent: 'Greek' }));
    tdMorph.appendChild(morphSelect);
    tdMorph.appendChild(elem('input', { type: 'text', placeholder: 'V-A?' }));
    const tdStyle = elem('div', { className: 'visualfilters-style visualfilters-cell' });
    const styleSelect = elem('select', { className: 'style-type' });
    styleSelect.appendChild(elem('option', { value: 'text', textContent: 'Text Color' }));
    styleSelect.appendChild(elem('option', { value: 'background', textContent: 'Background' }));
    styleSelect.appendChild(elem('option', { value: 'underline', textContent: 'Underline' }));
    tdStyle.appendChild(styleSelect);
    tdStyle.appendChild(elem('input', { type: 'color', className: 'style-color', value: '#ff3333' }));
    const tdRemove = elem('div', { className: 'visualfilters-remove visualfilters-cell' });
    tdRemove.appendChild(elem('span', { className: 'close-button' }));
    fragment.append(tdActive, tdStrongs, tdMorph, tdStyle, tdRemove);
    // Store reference to first cell so we can find this "row"
    tdActive.dataset.rowStart = 'true';
    return fragment;
  };

  // Helper to get row cells starting from a row-start cell
  const getRowCells = (startCell) => {
    const cells = [startCell];
    let next = startCell.nextElementSibling;
    // Get next 4 cells (5 cells total per row)
    for (let i = 0; i < 4 && next; i++) {
      cells.push(next);
      next = next.nextElementSibling;
    }
    return cells;
  };

  // Define saveTransforms before it's used in event handlers
  const saveTransforms = () => {
    visualSettings.transforms = [];

    // Find all row starts (skip header row by looking for visualfilters-cell)
    tbody.querySelectorAll('.visualfilters-cell[data-row-start="true"]').forEach(startCell => {
      const rowCells = getRowCells(startCell);
      const transform = {};

      const activeCell = rowCells.find(c => c.classList.contains('visualfilters-active'));
      const strongsCell = rowCells.find(c => c.classList.contains('visualfilters-strongs'));
      const morphCell = rowCells.find(c => c.classList.contains('visualfilters-morph'));
      const styleCell = rowCells.find(c => c.classList.contains('visualfilters-style'));

      const activeInput = activeCell?.querySelector('input');
      transform.active = activeInput?.checked ?? false;

      const strongsInput = strongsCell?.querySelector('input');
      transform.strongs = strongsInput?.value ?? '';

      const morphInput = morphCell?.querySelector('input');
      transform.morph = morphInput?.value ?? '';

      const morphSelect = morphCell?.querySelector('select');
      transform.morphType = morphSelect?.value ?? '';

      const styleTypeSelect = styleCell?.querySelector('.style-type');
      const styleColorInput = styleCell?.querySelector('.style-color');
      transform.styleType = styleTypeSelect?.value ?? 'text';
      transform.styleColor = styleColorInput?.value ?? '#ff3333';

      transform.style = buildStyleCss(transform.styleType, transform.styleColor);

      if (transform.morph !== '') {
        if (transform.morphType === 'robinson') {
          transform.morphRegExp = new RegExp(`^${transform.morph.replace(/\?/gi, '.{1}')}`, 'gi');
        } else if (transform.morphType === 'morphhb') {
          transform.morphRegExp = new RegExp(
            `(^H${transform.morph.replace(/\?/gi, '.{1}')})|(/${transform.morph.replace(/\?/gi, '.{1}')})`, 'gi'
          );
        }
      } else {
        transform.morphRegExp = null;
      }

      visualSettings.transforms.push(transform);
    });

    AppSettings.setValue(settingsKey, visualSettings);
  };

  // Define drawTransforms before it's called at the end
  const drawTransforms = () => {
    // Remove all data cells (keep header cells which don't have visualfilters-cell class)
    tbody.querySelectorAll('.visualfilters-cell').forEach(cell => cell.remove());

    for (const transform of visualSettings.transforms) {
      const fragment = createRow();

      const activeInput = fragment.querySelector('.visualfilters-active input');
      if (activeInput) activeInput.checked = transform.active;

      const strongsInput = fragment.querySelector('.visualfilters-strongs input');
      if (strongsInput) strongsInput.value = transform.strongs;

      const morphInput = fragment.querySelector('.visualfilters-morph input');
      if (morphInput) morphInput.value = transform.morph;

      const morphSelect = fragment.querySelector('.visualfilters-morph select');
      if (morphSelect) morphSelect.value = transform.morphType;

      // Populate new style controls
      const styleTypeSelect = fragment.querySelector('.visualfilters-style .style-type');
      const styleColorInput = fragment.querySelector('.visualfilters-style .style-color');
      if (styleTypeSelect) styleTypeSelect.value = transform.styleType || 'text';
      if (styleColorInput) styleColorInput.value = transform.styleColor || '#ff3333';

      tbody.appendChild(fragment);
    }
  };

  addRowButton.addEventListener('click', () => {
    const row = createRow();
    tbody.appendChild(row);
  });

  const filtersWindowTitle = filtersWindow.title;
  filtersWindowTitle.classList.add('i18n');
  filtersWindowTitle.setAttribute('data-i18n', '[html]plugins.visualfilters.title');

  openVisualizationsButton.addEventListener('click', () => {
    filtersWindow.show();
    filtersWindow.center();

    // Close the config window popover when opening visual filters
    const configWindow = document.querySelector('#config-window');
    if (configWindow?.matches(':popover-open')) {
      configWindow.hidePopover();
    }
  });

  tbody.addEventListener('click', (e) => {
    const target = e.target.closest('.visualfilters-remove');
    if (!target) return;

    // Find the row start cell by walking backwards
    let cell = target.classList.contains('visualfilters-cell') ? target : target.closest('.visualfilters-cell');
    while (cell && cell.dataset.rowStart !== 'true') {
      cell = cell.previousElementSibling;
    }

    if (cell) {
      // Remove all 5 cells of this row
      const rowCells = getRowCells(cell);
      rowCells.forEach(c => c.remove());
    }

    saveTransforms();
    VisualTransformer.resetTransforms(visualSettings);
  });

  tbody.addEventListener('change', (e) => {
    const target = e.target.closest('.visualfilters-active input, .visualfilters-morph select, .visualfilters-strongs input, .visualfilters-morph input, .style-type, .style-color');
    if (target) {
      saveTransforms();
      VisualTransformer.resetTransforms(visualSettings);
    }
  });

  tbody.addEventListener('keyup', (e) => {
    const target = e.target.closest('.visualfilters-strongs input, .visualfilters-morph input');
    if (target) {
      saveTransforms();
      VisualTransformer.resetTransforms(visualSettings);
    }
  });

  const filtersWindowContainer = filtersWindow.container;
  const closeButton = filtersWindowContainer.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      morphSelector.style.display = 'none';
    });
  }

  filtersWindowBody.addEventListener('click', (e) => {
    const input = e.target.closest('.visualfilters-morph input');
    if (!input) return;
    e.preventDefault();

    const morphSelectorVisible = morphSelector.style.display !== 'none';
    if (morphSelectorVisible && morphSelector.currentInput != null && morphSelector.currentInput === input) {
      morphSelector.style.display = 'none';
      return false;
    }

    const inputOffset = offset(input);
    morphSelector.style.top = `${inputOffset.top + input.offsetHeight}px`;
    morphSelector.style.left = `${inputOffset.left}px`;
    morphSelector.style.display = '';

    morphSelector.currentInput = input;
    const selectSibling = [...input.parentElement.children].filter(s => s !== input && s.matches('select'))[0];
    morphSelector.setMorphology(selectSibling?.value ?? '');
    morphSelector.updateMorphSelector(input.value);

    return false;
  });

  morphSelector.addEventListener('update', () => {
    saveTransforms();
    VisualTransformer.resetTransforms(visualSettings);
  });

  filtersWindowBody.addEventListener('click', () => {
    if (morphSelector.style.display !== 'none') {
      morphSelector.style.display = 'none';
    }
  });

  let ext = {
    sendMessage: () => {}
  };
  mixinEventEmitter(ext);

  ext.on('message', (e) => {
    if (e.data.messagetype === 'textload') {
      const contentEl = e.data.content;
      const lang = contentEl.getAttribute('lang');

      // Check if language starts with any of the valid prefixes
      // This handles variants like 'eng-Latn-US', 'heb-Hebr', etc.
      const validLangPrefixes = ['heb', 'gre', 'grc', 'eng'];
      const isValidLang = lang && validLangPrefixes.some(prefix =>
        lang === prefix || lang.startsWith(prefix + '-')
      );

      if (isValidLang) {
        VisualTransformer.runTransforms(contentEl, visualSettings);
      }
    }
  });

  drawTransforms();
  saveTransforms();

  return ext;
}

export { VisualTransformer };
export default VisualFilters;
