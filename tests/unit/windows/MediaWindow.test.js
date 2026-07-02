import { describe, it, expect, vi } from 'vitest';
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

/**
 * Unconnected media-window element: the constructor runs (state, refs), but
 * render/init never do, so tests drive selectMediaItem/findGalleryIndex
 * directly with stubbed collaborators.
 */
function buildWindow({ items = [], filters, sectionid = 'GN12' } = {}) {
  const win = document.createElement('media-window');
  win.mediaLibraries = [];
  win.state.currentSectionId = sectionid;
  if (filters) win.state.filters = filters;
  win.state.galleryItems = items;
  win.showGalleryItem = vi.fn(() => Promise.resolve());
  return win;
}

const item = (folder, filename, verseid) => ({ folder, filename, verseid });

describe('MediaWindow findGalleryIndex', () => {
  const items = [
    item('art', 'abraham-journey', 'GN12_1'),
    item('art', 'lot-parts', 'GN13_11'),
    item('maps', 'abraham-journey', 'GN12_4')
  ];

  it('matches exact folder + filename', () => {
    const win = buildWindow({ items });
    expect(win.findGalleryIndex({ folder: 'maps', filename: 'abraham-journey', verseid: 'GN12_4' })).toBe(2);
  });

  it('falls back to the base file for a -color variant', () => {
    // The gallery skips '-color' files but the popup lists them
    const win = buildWindow({ items });
    expect(win.findGalleryIndex({ folder: 'art', filename: 'abraham-journey-color', verseid: 'GN12_1' })).toBe(0);
  });

  it('falls back to any item on the same verse', () => {
    const win = buildWindow({ items });
    expect(win.findGalleryIndex({ folder: 'art', filename: 'not-in-gallery', verseid: 'GN13_11' })).toBe(1);
  });

  it('returns -1 when nothing matches', () => {
    const win = buildWindow({ items });
    expect(win.findGalleryIndex({ folder: 'art', filename: 'nope', verseid: 'GN99_1' })).toBe(-1);
  });
});

describe('MediaWindow selectMediaItem', () => {
  const select = { sectionid: 'GN12', verseid: 'GN12_1', folder: 'art', filename: 'abraham-journey' };

  it('stashes the request until the media libraries load', () => {
    const win = buildWindow();
    win.mediaLibraries = null;

    win.selectMediaItem(select);

    expect(win.pendingSelect).toBe(select);
    expect(win.showGalleryItem).not.toHaveBeenCalled();
  });

  it('shows the matching gallery item', () => {
    const win = buildWindow({ items: [item('art', 'abraham-journey', 'GN12_1')] });

    win.selectMediaItem(select);

    expect(win.showGalleryItem).toHaveBeenCalledWith(0);
  });

  it('switches to the requested section before matching', () => {
    const win = buildWindow({ items: [], sectionid: 'GN11' });
    const section = document.createElement('div');
    section.className = 'section';
    section.setAttribute('data-id', 'GN12');
    document.body.appendChild(section);
    win.processContent = vi.fn(() => {
      win.state.galleryItems = [item('art', 'abraham-journey', 'GN12_1')];
    });

    win.selectMediaItem(select);

    expect(win.contentToProcess).toBe(section);
    expect(win.processContent).toHaveBeenCalled();
    expect(win.showGalleryItem).toHaveBeenCalledWith(0);
    section.remove();
  });

  it('re-enables the art filter and retries when the item is filtered out', () => {
    const win = buildWindow({ items: [], filters: { art: false, video: true } });
    win.setFilter = vi.fn((type, enabled) => {
      win.state.filters[type] = enabled;
      // simulates the re-render that setFilter triggers
      win.state.galleryItems = [item('art', 'abraham-journey', 'GN12_1')];
    });

    win.selectMediaItem(select);

    expect(win.setFilter).toHaveBeenCalledWith('art', true);
    expect(win.showGalleryItem).toHaveBeenCalledWith(0);
  });

  it('gives up gracefully when nothing matches', () => {
    const win = buildWindow({ items: [item('art', 'other-image', 'GN12_9')] });

    win.selectMediaItem(select);

    expect(win.showGalleryItem).not.toHaveBeenCalled();
  });
});
