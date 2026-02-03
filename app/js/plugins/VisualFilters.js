/**
 * VisualFilters
 * Highlights words based on morphological data (Strong's numbers, Greek/Hebrew morphology)
 */

import { createElements, offset, deepMerge } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { MovableWindow } from '../ui/MovableWindow.js';

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

    const sectionEl = sectionNode;

    sectionEl.querySelectorAll('l').forEach(word => {
      for (const transform of visualSettings.transforms) {
        let isMatch = false;

        if (!transform.active) continue;

        // Strong's number
        if (transform.strongs !== '') {
          if (word.getAttribute('s') === transform.strongs) {
            isMatch = true;
          } else {
            continue;
          }
        }

        // Morphology
        if (transform.morph !== '') {
          if (transform.morphRegExp?.test) {
            const wordMorphData = word.getAttribute('m');

            if (wordMorphData != null && transform.morphRegExp.test(wordMorphData)) {
              isMatch = true;
            } else {
              continue;
            }
          }
        }

        if (isMatch) {
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

  const morphSelector = createElements(
    `<div class="morph-selector"><table>` +
      `<thead><tr><th>Part of Speech</th></tr></thead>` +
      `<tbody><tr></tr></tbody>` +
    `</table></div>`
  );

  document.body.appendChild(morphSelector);
  morphSelector.style.display = 'none';

  const morphSelectorHeaderRow = morphSelector.querySelector('thead tr');
  const morphSelectorMainRow = morphSelector.querySelector('tbody tr');
  const morphSelectorPOS = createElements('<td class="morph-pos"></td>');
  morphSelectorMainRow.appendChild(morphSelectorPOS);

  // Define drawSelectedPartOfSpeech before drawPartsOfSpeech (which calls it)
  const drawSelectedPartOfSpeech = () => {
    const firstTh = morphSelectorHeaderRow.querySelector('th');
    [...firstTh.parentElement.children].filter(s => s !== firstTh).forEach(sibling => {
      sibling.parentNode.removeChild(sibling);
    });

    const firstTd = morphSelectorMainRow.querySelector('td');
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

    const tr = selectedSpan.closest('tr');
    for (const declension of partOfSpeech.declensions) {
      const th = createElements(`<th>${declension.declension}</th>`);
      const td = document.createElement('td');

      morphSelectorHeaderRow.appendChild(th);
      tr.appendChild(td);

      for (const part of declension.parts) {
        const span = createElements(`<span data-value="${part.letter}"${declension.breakBefore ? ' data-breakbefore="true"' : ''}>${part.type}</span>`);
        td.appendChild(span);
      }
    }

    const table = morphSelector.querySelector('table');
    morphSelector.style.height = `${table.offsetHeight}px`;
  };

  // Define drawPartsOfSpeech before setMorphology (which calls it)
  const drawPartsOfSpeech = () => {
    morphSelectorPOS.innerHTML = '';

    for (const morph of currentMorphology) {
      const span = createElements(`<span data-value="${morph.letter}">${morph.type}</span>`);
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

  const updateMorphSelector = (value) => {
    if (value.length === 0) {
      morphSelector.querySelectorAll('span').forEach(span => {
        span.classList.remove('selected');
      });
      drawSelectedPartOfSpeech();
      return;
    }

    const firstChar = value.substring(0, 1);
    const partOfSpeechSpan = morphSelectorPOS.querySelector(`span[data-value="${firstChar}"]`);

    if (partOfSpeechSpan) {
      partOfSpeechSpan.classList.add('selected');
      [...partOfSpeechSpan.parentElement.children].filter(s => s !== partOfSpeechSpan).forEach(sibling => {
        sibling.classList.remove('selected');
      });

      drawSelectedPartOfSpeech();

      if (value.length > 1) {
        let remainder = value.substr(1);
        if (remainder.substr(0, 1) === '-') {
          remainder = remainder.substr(1);
        }

        for (let i = 0; i < remainder.length; i++) {
          const letter = remainder[i];
          const td = morphSelectorMainRow.querySelector(`td:nth-child(${i + 2})`);
          if (td) {
            const letterSpan = td.querySelector(`span[data-value="${letter}"]`);
            if (letterSpan) {
              letterSpan.classList.add('selected');
            }
          }
        }
      }
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

    const parentTd = selectedSpan.closest('td');
    if (parentTd?.classList.contains('morph-pos')) {
      drawSelectedPartOfSpeech();
    }

    let selector = '';
    let lastPartOfSpeechWithSelection = -1;

    const tr = selectedSpan.closest('tr');
    const tds = tr.querySelectorAll('td');
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

  const visualNode = createElements(
    `<div id="visualfilters-config">` +
      `<input type="button" value="New Filter" />` +
      `<table>` +
        `<thead>` +
          `<tr>` +
            `<th class="visualfilters-active"></th>` +
            `<th class="visualfilters-strongs i18n" data-i18n="[html]plugins.visualfilters.strongsnumber">Strong's</th>` +
            `<th class="visualfilters-morph i18n" data-i18n="[html]plugins.visualfilters.morphology">Morphology</th>` +
            `<th class="visualfilters-style i18n" data-i18n="[html]plugins.visualfilters.style">Style</th>` +
            `<th class="visualfilters-remove"></th>` +
          `</tr>` +
        `</thead>` +
        `<tbody></tbody>` +
      `</table>` +
    `</div>`
  );

  const filtersWindowBody = filtersWindow.body;
  filtersWindowBody.appendChild(visualNode);

  const morphSelector = MorphologySelector();
  const tbody = visualNode.querySelector('tbody');
  const addRowButton = visualNode.querySelector('input');

  const configToolsBody = document.querySelector('#config-tools .config-body');
  const openVisualizationsButton = createElements('<span class="config-button i18n" data-i18n="[html]plugins.visualfilters.button" id="config-visualfilters-button"></span>');

  if (configToolsBody) {
    configToolsBody.appendChild(openVisualizationsButton);
  }

  // Define createRow before it's used in drawTransforms and addRowButton click handler
  const createRow = () => createElements(
    `<tr>` +
      `<td class="visualfilters-active"><input type="checkbox" checked /></td>` +
      `<td class="visualfilters-strongs"><input type="text" placeholder="G2424, H234" /></td>` +
      `<td class="visualfilters-morph">` +
        `<select><option value="morphhb">Hebrew</option><option value="robinson">Greek</option></select>` +
        `<input type="text" placeholder="V-A?" />` +
      `</td>` +
      `<td class="visualfilters-style">` +
        `<select class="style-type">` +
          `<option value="text">Text Color</option>` +
          `<option value="background">Background</option>` +
          `<option value="underline">Underline</option>` +
        `</select>` +
        `<input type="color" class="style-color" value="#ff3333" />` +
      `</td>` +
      `<td class="visualfilters-remove"><span class="close-button"></span></td>` +
    `</tr>`
  );

  // Define saveTransforms before it's used in event handlers
  const saveTransforms = () => {
    visualSettings.transforms = [];

    tbody.querySelectorAll('tr').forEach(row => {
      const transform = {};

      const activeInput = row.querySelector('.visualfilters-active input');
      transform.active = activeInput?.checked ?? false;

      const strongsInput = row.querySelector('.visualfilters-strongs input');
      transform.strongs = strongsInput?.value ?? '';

      const morphInput = row.querySelector('.visualfilters-morph input');
      transform.morph = morphInput?.value ?? '';

      const morphSelect = row.querySelector('.visualfilters-morph select');
      transform.morphType = morphSelect?.value ?? '';

      // Get style type and color from new controls
      const styleTypeSelect = row.querySelector('.visualfilters-style .style-type');
      const styleColorInput = row.querySelector('.visualfilters-style .style-color');
      transform.styleType = styleTypeSelect?.value ?? 'text';
      transform.styleColor = styleColorInput?.value ?? '#ff3333';

      // Build CSS from type and color
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
    tbody.innerHTML = '';

    for (const transform of visualSettings.transforms) {
      const row = createRow();

      const activeInput = row.querySelector('.visualfilters-active input');
      if (activeInput) activeInput.checked = transform.active;

      const strongsInput = row.querySelector('.visualfilters-strongs input');
      if (strongsInput) strongsInput.value = transform.strongs;

      const morphInput = row.querySelector('.visualfilters-morph input');
      if (morphInput) morphInput.value = transform.morph;

      const morphSelect = row.querySelector('.visualfilters-morph select');
      if (morphSelect) morphSelect.value = transform.morphType;

      // Populate new style controls
      const styleTypeSelect = row.querySelector('.visualfilters-style .style-type');
      const styleColorInput = row.querySelector('.visualfilters-style .style-color');
      if (styleTypeSelect) styleTypeSelect.value = transform.styleType || 'text';
      if (styleColorInput) styleColorInput.value = transform.styleColor || '#ff3333';

      tbody.appendChild(row);
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
    const tr = target.closest('tr');
    if (tr) {
      tr.parentNode.removeChild(tr);
    }

    saveTransforms();
    VisualTransformer.resetTransforms(visualSettings);
  });

  // Handle changes on all filter inputs including new style controls
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
  ext = deepMerge(ext, EventEmitterMixin);

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
