import { describe, it, expect } from 'vitest';
import {
  processVerseContent,
  extractVerses,
  buildFootnotesHtml
} from '@verse-detection/VerseExtractor.ts';

const config = { showVerseNumbers: false };

function makeChapterHtml(verses) {
  // verses: array of { id, html }
  const items = verses
    .map(({ id, html }) => `<span class="v" data-id="${id}">${html}</span>`)
    .join('');
  return `<div class="section">${items}</div>`;
}

describe('processVerseContent', () => {
  it('strips verse-number elements and leaves text', () => {
    const el = document.createElement('span');
    el.innerHTML = '<span class="v-num">1</span>In the beginning';
    const footnotes = [];
    const out = processVerseContent(el, footnotes);
    expect(out).toBe('In the beginning');
    expect(footnotes).toHaveLength(0);
  });

  it('extracts footnotes and replaces with marker', () => {
    const el = document.createElement('span');
    el.innerHTML = 'For God so loved <span class="note"><span class="key">a</span><span class="text">Or: agape love</span></span> the world';
    const footnotes = [];
    const out = processVerseContent(el, footnotes);
    expect(out).toContain('<span class="note-marker">a</span>');
    expect(footnotes).toEqual([{ key: 'a', text: 'Or: agape love' }]);
  });
});

describe('extractVerses', () => {
  const html = makeChapterHtml([
    { id: 'JN3_16', html: 'For God so loved the world' },
    { id: 'JN3_17', html: 'For God did not send' },
    { id: 'JN3_18', html: 'Whoever believes' }
  ]);

  it('extracts a single verse by sectionId+verse number', () => {
    const result = extractVerses(html, { sectionId: 'JN3', startVerse: 16 }, config);
    expect(result.content).toContain('For God so loved the world');
    expect(result.content).not.toContain('did not send');
  });

  it('extracts a verse range', () => {
    const result = extractVerses(html, { sectionId: 'JN3', startVerse: 16, endVerse: 18 }, config);
    expect(result.content).toContain('For God so loved the world');
    expect(result.content).toContain('did not send');
    expect(result.content).toContain('Whoever believes');
  });

  it('extracts the entire chapter when no startVerse', () => {
    const result = extractVerses(html, { sectionId: 'JN3' }, config);
    expect(result.content).toContain('For God so loved the world');
    expect(result.content).toContain('Whoever believes');
  });

  it('throws when verse not found', () => {
    expect(() =>
      extractVerses(html, { sectionId: 'JN3', startVerse: 99 }, config)
    ).toThrow(/not found/i);
  });

  it('honors showVerseNumbers config', () => {
    const result = extractVerses(html, { sectionId: 'JN3', startVerse: 16 }, { showVerseNumbers: true });
    expect(result.content).toContain('<span class="v-num">16</span>');
  });
});

describe('buildFootnotesHtml', () => {
  it('returns empty string when no footnotes', () => {
    expect(buildFootnotesHtml([])).toBe('');
  });

  it('renders a footnote block with keys and text', () => {
    const html = buildFootnotesHtml([
      { key: 'a', text: 'Some note' },
      { key: 'b', text: 'Another' }
    ]);
    expect(html).toContain('verse-popup-footnotes');
    expect(html).toContain('Some note');
    expect(html).toContain('Another');
    expect(html).toContain('fn-key');
  });
});
