import { describe, it, expect, beforeEach } from 'vitest';
import { highlightLocations, removeHighlights } from '@windows/MapWindow/highlight.js';

/** Build a fake Bible window with one verse element per entry. */
function makeBibleDom(verses) {
  document.body.innerHTML = '';
  const win = document.createElement('div');
  win.className = 'BibleWindow';
  for (const { id, html } of verses) {
    const verse = document.createElement('span');
    verse.className = 'verse';
    verse.setAttribute('data-id', id);
    verse.innerHTML = html;
    win.appendChild(verse);
  }
  document.body.appendChild(win);
  return win;
}

/** Build a fake markers overlay with one .map-marker per location. */
function makeOverlay(locations) {
  const overlay = document.createElement('div');
  for (const location of locations) {
    const marker = document.createElement('div');
    marker.className = 'map-marker';
    marker.locationData = location;
    overlay.appendChild(marker);
  }
  return overlay;
}

const spans = () => [...document.querySelectorAll('.linked-location')];

describe('highlightLocations', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('highlights a name whose data form ends in "?" without matching prefixes', () => {
    const luz = { name: 'Luz?', verses: ['GN28_19'] };
    makeBibleDom([{ id: 'GN28_19', html: 'the name of that city was Luz, but Lu remained' }]);

    highlightLocations(null, { GN28_19: [luz] });

    const found = spans();
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('Luz');
    expect(found[0].getAttribute('data-location-name')).toBe('Luz?');
  });

  it('does not throw on names containing regex metacharacters', () => {
    const weird = { name: 'A(B)C.D', verses: ['GN1_1'] };
    makeBibleDom([{ id: 'GN1_1', html: 'here is A(B)C.D in text' }]);

    expect(() => highlightLocations(null, { GN1_1: [weird] })).not.toThrow();
    expect(spans()).toHaveLength(1);
    expect(spans()[0].textContent).toBe('A(B)C.D');
  });

  it('prefers the longest name when names overlap', () => {
    const abel = { name: 'Abel', verses: ['2S20_14'] };
    const abm = { name: 'Abel-beth-maacah', verses: ['2S20_14'] };
    makeBibleDom([{ id: '2S20_14', html: 'they came to Abel-beth-maacah' }]);

    highlightLocations(null, { '2S20_14': [abel, abm] });

    const found = spans();
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('Abel-beth-maacah');
    expect(found[0].getAttribute('data-location-name')).toBe('Abel-beth-maacah');
  });

  it('preserves the source casing of the matched text', () => {
    const jer = { name: 'Jerusalem', verses: ['PS122_2'] };
    makeBibleDom([{ id: 'PS122_2', html: 'O JERUSALEM, city of God' }]);

    highlightLocations(null, { PS122_2: [jer] });

    expect(spans()[0].textContent).toBe('JERUSALEM');
  });

  it('does not corrupt markup or match inside attributes', () => {
    const salem = { name: 'Salem', verses: ['GN14_18'] };
    makeBibleDom([{ id: 'GN14_18', html: 'king of <span data-place="Salem">Salem</span> brought bread' }]);

    highlightLocations(null, { GN14_18: [salem] });

    const inner = document.querySelector('[data-place="Salem"]');
    expect(inner).not.toBeNull();
    expect(inner.getAttribute('data-place')).toBe('Salem');
    expect(spans()).toHaveLength(1);
  });

  it('does not double-wrap on repeated calls', () => {
    const jer = { name: 'Jerusalem', verses: ['PS122_2'] };
    makeBibleDom([{ id: 'PS122_2', html: 'up to Jerusalem we go' }]);

    highlightLocations(null, { PS122_2: [jer] });
    highlightLocations(null, { PS122_2: [jer] });

    expect(spans()).toHaveLength(1);
    expect(document.querySelectorAll('.linked-location .linked-location')).toHaveLength(0);
  });

  it('adds the highlighted class to matching markers and clears filtered-out', () => {
    const jer = { name: 'Jerusalem', verses: ['PS122_2'] };
    const beth = { name: 'Bethlehem', verses: ['MT2_1'] };
    makeBibleDom([{ id: 'PS122_2', html: 'up to Jerusalem' }]);
    const overlay = makeOverlay([jer, beth]);
    overlay.children[0].classList.add('filtered-out');

    highlightLocations(overlay, { PS122_2: [jer] });

    expect(overlay.children[0].classList.contains('highlighted')).toBe(true);
    expect(overlay.children[0].classList.contains('filtered-out')).toBe(false);
    expect(overlay.children[1].classList.contains('highlighted')).toBe(false);
  });
});

describe('removeHighlights', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('restores the original verse text and merges text nodes', () => {
    const jer = { name: 'Jerusalem', verses: ['PS122_2'] };
    const original = 'we stand within your gates, O Jerusalem, forever';
    makeBibleDom([{ id: 'PS122_2', html: original }]);

    highlightLocations(null, { PS122_2: [jer] });
    expect(spans()).toHaveLength(1);

    removeHighlights(null);

    const verse = document.querySelector('.verse');
    expect(spans()).toHaveLength(0);
    expect(verse.textContent).toBe(original);
    expect(verse.childNodes).toHaveLength(1); // normalized back to a single text node
  });

  it('removes the highlighted class from markers', () => {
    const jer = { name: 'Jerusalem', verses: ['PS122_2'] };
    const overlay = makeOverlay([jer]);
    overlay.children[0].classList.add('highlighted');

    removeHighlights(overlay);

    expect(overlay.children[0].classList.contains('highlighted')).toBe(false);
  });
});
