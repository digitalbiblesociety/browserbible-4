import { describe, it, expect } from 'vitest';
import { pickSection } from '@windows/MediaWindow.js';

/**
 * Builds a scroller-wrapper-like container holding one or more chapter sections,
 * mirroring the markup produced by the text providers
 * (`<div class="section chapter ... ${sectionid}" data-id="${sectionid}">`).
 */
function buildWrapper(sections) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = sections
    .map(({ id, verses }) => {
      const verseHtml = verses
        .map((vid) => `<span class="v ${vid}" data-id="${vid}">${vid}</span>`)
        .join('');
      return `<div class="section chapter ${id}" data-id="${id}">${verseHtml}</div>`;
    })
    .join('');
  return wrapper;
}

describe('MediaWindow pickSection', () => {
  it('picks the section matching sectionid when several chapters are loaded', () => {
    // Regression: broadcastCurrentContent can ship the whole wrapper (Luke 14 + 15 + …).
    // Picking the first section showed Luke 14 media under a "Luke 15" title.
    const wrapper = buildWrapper([
      { id: 'LK14', verses: ['LK14_7', 'LK14_12', 'LK14_25'] },
      { id: 'LK15', verses: ['LK15_1', 'LK15_11'] },
      { id: 'LK16', verses: ['LK16_1'] },
    ]);

    const section = pickSection(wrapper, 'LK15');

    expect(section.getAttribute('data-id')).toBe('LK15');
    const verseIds = [...section.querySelectorAll('.v')].map((v) => v.getAttribute('data-id'));
    expect(verseIds).toEqual(['LK15_1', 'LK15_11']);
  });

  it('returns the lone section when only one chapter is loaded', () => {
    const wrapper = buildWrapper([{ id: 'LK15', verses: ['LK15_1'] }]);
    expect(pickSection(wrapper, 'LK15').getAttribute('data-id')).toBe('LK15');
  });

  it('falls back to the first section when sectionid is not present', () => {
    const wrapper = buildWrapper([
      { id: 'LK14', verses: ['LK14_7'] },
      { id: 'LK16', verses: ['LK16_1'] },
    ]);
    expect(pickSection(wrapper, 'LK15').getAttribute('data-id')).toBe('LK14');
  });

  it('falls back to the container when there are no sections', () => {
    const wrapper = document.createElement('div');
    expect(pickSection(wrapper, 'LK15')).toBe(wrapper);
  });
});
