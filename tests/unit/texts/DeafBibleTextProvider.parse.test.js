import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parsePassage,
  buildTitle,
  buildSectionHtml,
  DeafBibleTextProvider
} from '@texts/DeafBibleTextProvider.js';

// The internal entry shape produced by catalogToEntry from a catalog record.
const ENTRY = {
  iso: 'ase',
  language: 'American Sign Language',
  direction: 'ltr',
  primaryCountry: 'US',
  directory: 'ase_american-sign-language',
  file: 'ase_american-sign-language_deaf_bible.json',
  cover: ''
};

// A per-title metadata JSON in the current upstream shape (sections[].items with nested media).
const mediaItem = (over) => ({
  media: {
    high: { url: over.high },
    low: over.low ? { url: over.low } : undefined
  },
  book: over.book,
  reference: over.reference,
  title: over.title,
  cover: over.cover,
  duration_human: over.duration_human
});

const RAW = {
  cover: 'https://meta.dbs.org/data/data-video/covers/DeafBible/ase_american-sign-language/title.webp',
  description: 'Scripture in ASL.',
  org: { url: 'https://deafbiblesociety.com/about/' },
  language: { direction: 'ltr' },
  country: { id: 'US', name: 'United States' },
  sections: [{
    items: [
      mediaItem({
        book: 'Genesis',
        reference: 'Genesis 1:1-31; 2:1-4',
        title: 'The Creation of the World — Genesis 1:1-31; 2:1-4',
        high: 'https://video.dbs.org/DeafBible/chapters/ase_american-sign-language/g_0001.mp4',
        low: 'https://video.dbs.org/DeafBible/chapters_low/ase_american-sign-language/g_0001_360.mp4',
        cover: 'https://video.dbs.org/DeafBible/covers/ase_american-sign-language/g_0001.webp'
      }),
      // Same starting chapter as the next passage — must be grouped into GN2.
      mediaItem({ book: 'Genesis', reference: 'Genesis 2:5-25', title: 'Man and Woman', high: 'https://video.dbs.org/a/g2a.mp4' }),
      mediaItem({ book: 'Genesis', reference: 'Genesis 2:18-24', title: 'Marriage', high: 'https://video.dbs.org/a/g2b.mp4' }),
      mediaItem({ book: 'John', reference: 'John 1:1-18', title: 'The Word', high: 'https://video.dbs.org/a/j1.mp4' })
    ]
  }]
};

describe('getTextManifest', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lists Deaf Bible titles from the video catalog, filtering out other products', async () => {
    // Master catalog with abbreviated keys: two Deaf Bibles and one non-Deaf product.
    const catalog = [
      { i: 'ase', l: 'American Sign Language', o: 'DeafBible', c: 'US', j: 'ase_american-sign-language_deaf_bible.json', p: 'deafbible.webp', k: 1610 },
      { i: 'aed', l: 'Argentine Sign Language', o: 'DeafBible', c: 'AR', j: 'aed_argentine-sign-language_deaf_bible.json', p: 'deafbible.webp', k: 136 },
      { i: 'xyz', l: 'Some Language', o: 'Jesus', c: 'US', j: 'xyz_jesus.json', p: 'j.webp', k: 200 }
    ];
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(catalog) })));

    const manifest = await new Promise((resolve) => { DeafBibleTextProvider.getTextManifest(resolve); });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('video.json'));
    expect(manifest).toHaveLength(2); // the Jesus-film entry is filtered out
    expect(manifest.every((t) => t.type === 'deafbible')).toBe(true);
    expect(manifest.every((t) => t.id.startsWith('deaf_'))).toBe(true);
    expect(manifest.every((t) => t.hasText === true)).toBe(true);

    const ase = manifest.find((t) => t.id === 'deaf_ASE');
    expect(ase).toBeTruthy();
    expect(ase.lang).toBe('ase');
    expect(ase.name).toBe('American Sign Language');
  });
});

describe('parsePassage', () => {
  it('maps full English book names to DBS codes and starting chapter/verse', () => {
    expect(parsePassage('Genesis', 'Genesis 1:1-31; 2:1-4')).toEqual({ code: 'GN', sectionid: 'GN1', verse: '1' });
    expect(parsePassage('Mark', 'Mark 1:1-45')).toEqual({ code: 'MK', sectionid: 'MK1', verse: '1' });
    expect(parsePassage('John', 'John 3:16')).toEqual({ code: 'JN', sectionid: 'JN3', verse: '16' });
  });

  it('handles multi-word and numbered book names', () => {
    // 1 Samuel is code S1; chapter 11 -> section id "S111" (2-char code + chapter).
    expect(parsePassage('1 Samuel', '1 Samuel 11:1-15')).toEqual({ code: 'S1', sectionid: 'S111', verse: '1' });
    expect(parsePassage('Song of Solomon', 'Song of Solomon 2:1-7')?.code).toBe('SS');
    expect(parsePassage('Psalms', 'Psalms 23:1-6')).toEqual({ code: 'PS', sectionid: 'PS23', verse: '1' });
  });

  it('defaults the verse to 1 when the reference has no verse', () => {
    expect(parsePassage('Psalms', 'Psalm 23')).toEqual({ code: 'PS', sectionid: 'PS23', verse: '1' });
  });

  it('returns null for an unknown book', () => {
    expect(parsePassage('Nonexistent', 'Nonexistent 1:1')).toBeNull();
  });
});

describe('buildTitle', () => {
  const { info, sectionPassages } = buildTitle(ENTRY, RAW);

  it('produces deafbible text info with a deaf_<ISO> id', () => {
    expect(info.type).toBe('deafbible');
    expect(info.id).toBe('deaf_ASE');
    expect(info.abbr).toBe('ASE');
    expect(info.lang).toBe('ase');
    expect(info.name).toBe('American Sign Language');
    expect(info.cover).toBe(RAW.cover); // per-title cover, not the (empty) catalog cover
  });

  it('collects divisions in first-appearance order', () => {
    expect(info.divisions).toEqual(['GN', 'JN']);
    expect(info.divisionNames).toEqual(['Genesis', 'John']);
  });

  it('groups passages by starting chapter into sections', () => {
    expect(info.sections).toEqual(['GN1', 'GN2', 'JN1']);
    expect(sectionPassages.get('GN2')).toHaveLength(2);
    expect(sectionPassages.get('GN1')).toHaveLength(1);
  });

  it('links to the Deaf Bible Society in the about page', () => {
    expect(info.aboutHtml).toContain('deafbiblesociety.com');
  });
});

describe('buildSectionHtml', () => {
  const { info, sectionPassages } = buildTitle(ENTRY, RAW);

  it('renders a .section with dbs.org videos and verse fragments', () => {
    const html = buildSectionHtml(info, 'GN1', sectionPassages.get('GN1'));
    expect(html).toContain('class="section chapter deaf_ASE GN GN1 ase');
    expect(html).toContain('data-id="GN1"');
    expect(html).toContain('data-previd="null"');
    expect(html).toContain('data-nextid="GN2"');
    expect(html).toContain('<div class="mt">Genesis 1</div>');
    expect(html).toContain('data-id="GN1_1"');
    expect(html).toContain('<video src="https://video.dbs.org/DeafBible/chapters/ase_american-sign-language/g_0001.mp4"');
    expect(html).toContain('poster="https://video.dbs.org/DeafBible/covers/ase_american-sign-language/g_0001.webp"');
  });

  it('emits one <video> per grouped passage', () => {
    const html = buildSectionHtml(info, 'GN2', sectionPassages.get('GN2'));
    expect(html.match(/<video /g)).toHaveLength(2);
    expect(html).toContain('data-id="GN2_5"');
    expect(html).toContain('data-id="GN2_18"');
  });

  it('falls back to the title cover when a passage has no poster', () => {
    const html = buildSectionHtml(info, 'JN1', sectionPassages.get('JN1'));
    expect(html).toContain(`poster="${info.cover}"`);
  });

  it('splits numbered book codes (2-char code + chapter) correctly', () => {
    const built = buildTitle(ENTRY, {
      sections: [{ items: [mediaItem({ book: '1 Samuel', reference: '1 Samuel 11:1-15', title: 'Saul', high: 'https://video.dbs.org/a/s1.mp4' })] }]
    });
    expect(built.info.sections).toEqual(['S111']);
    const html = buildSectionHtml(built.info, 'S111', built.sectionPassages.get('S111'));
    // bookid must be "S1" (not "S"), chapter "11".
    expect(html).toContain('class="section chapter deaf_ASE S1 S111 ase');
    expect(html).toContain('<div class="mt">The First Book of Samuel 11</div>');
  });
});
