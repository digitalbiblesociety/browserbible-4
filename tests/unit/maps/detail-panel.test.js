import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDetailHTML, hydrateVerseTexts } from '@windows/MapWindow/detail-panel.js';

const location = {
  name: 'Bethlehem',
  type: 'city',
  coordinates: [35.2, 31.7],
  verses: ['MT2_1', 'MT2_5', 'LK2_4']
};

/** Render buildDetailHTML into a live container. */
function renderPanel(loc = location, verseTextLookup = null) {
  const container = document.createElement('div');
  container.innerHTML = buildDetailHTML(loc, verseTextLookup, []);
  document.body.appendChild(container);
  return container;
}

/** Fake loadSection: returns a content node with one verse element per entry. */
function makeLoader(sectionVerses) {
  return vi.fn((textid, sectionid, success, error) => {
    const verses = sectionVerses[sectionid];
    if (!verses) {
      error?.(new Error('not found'));
      return;
    }
    const content = document.createElement('div');
    for (const [fragmentid, text] of Object.entries(verses)) {
      const el = document.createElement('span');
      el.className = fragmentid;
      el.textContent = text;
      content.appendChild(el);
    }
    success(content);
  });
}

describe('buildDetailHTML', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders a pending placeholder for verses with no available text', () => {
    const container = renderPanel();
    expect(container.querySelectorAll('.verse-text-pending')).toHaveLength(3);
  });

  it('renders text directly when the lookup provides it', () => {
    const container = renderPanel(location, () => 'now when Jesus was born in Bethlehem');
    expect(container.querySelectorAll('.verse-text-pending')).toHaveLength(0);
    expect(container.textContent).toContain('now when Jesus was born');
  });
});

describe('hydrateVerseTexts', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('fills pending rows from the loaded section, one fetch per section', () => {
    const container = renderPanel();
    const loader = makeLoader({
      MT2: { MT2_1: 'wise men came to Jerusalem', MT2_5: 'in Bethlehem of Judea' },
      LK2: { LK2_4: 'Joseph also went up from Galilee' }
    });

    hydrateVerseTexts(container, 'ENGWEB', loader);

    expect(loader).toHaveBeenCalledTimes(2); // MT2 and LK2, not one per verse
    expect(container.querySelectorAll('.verse-text-pending')).toHaveLength(0);
    expect(container.textContent).toContain('wise men came to Jerusalem');
    expect(container.textContent).toContain('Joseph also went up');
  });

  it('marks verses missing from the loaded content as unavailable', () => {
    const container = renderPanel();
    const loader = makeLoader({
      MT2: { MT2_1: 'wise men came to Jerusalem' }, // MT2_5 absent
      LK2: { LK2_4: 'Joseph also went up' }
    });

    hydrateVerseTexts(container, 'ENGWEB', loader);

    const missing = container.querySelectorAll('.verse-text-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].closest('.verse').getAttribute('data-fragmentid')).toBe('MT2_5');
  });

  it('marks all rows of a section unavailable when the load fails', () => {
    const container = renderPanel();
    const loader = makeLoader({ LK2: { LK2_4: 'Joseph also went up' } }); // MT2 errors

    hydrateVerseTexts(container, 'ENGWEB', loader);

    expect(container.querySelectorAll('.verse-text-missing')).toHaveLength(2);
    expect(container.querySelectorAll('.verse-text-pending')).toHaveLength(0);
  });

  it('is a no-op when there is nothing pending', () => {
    const container = renderPanel(location, () => 'text for every verse');
    const loader = vi.fn();

    hydrateVerseTexts(container, 'ENGWEB', loader);

    expect(loader).not.toHaveBeenCalled();
  });
});
