import { describe, it, expect } from 'vitest';
import {
  flattenFilesets,
  selectFilesets,
  selectTextFileset,
  filesetCoversTestament,
  entryToTextInfo,
  normalizeChapters,
  versesToHtml,
  extractSearchVerses
} from '@texts/BibleBrainTextProvider.js';

describe('flattenFilesets', () => {
  it('flattens the bucket-keyed object into one array', () => {
    const filesets = {
      'dbp-prod': [{ id: 'A' }, { id: 'B' }],
      'dbp-vid': [{ id: 'C' }]
    };
    expect(flattenFilesets(filesets).map(f => f.id)).toEqual(['A', 'B', 'C']);
  });

  it('tolerates missing/non-object input', () => {
    expect(flattenFilesets(undefined)).toEqual([]);
    expect(flattenFilesets(null)).toEqual([]);
  });
});

describe('selectFilesets', () => {
  it('keeps text_plain (ignoring text_format/usx/json) and collects non-stream audio', () => {
    const filesets = {
      'dbp-prod': [
        { id: 'ENGESVN_ET', type: 'text_plain', size: 'NT' },
        { id: 'ENGESVO_ET', type: 'text_plain', size: 'OT' },
        { id: 'ENGESVN_ET-usx', type: 'text_usx', size: 'NT' },
        { id: 'ENGESVN1DA', type: 'audio', size: 'NT' },
        { id: 'ENGESVN2DA', type: 'audio_drama', size: 'NT' },
        { id: 'ENGESVN1SA', type: 'audio_stream', size: 'NT' },
        { id: 'ENGESVP2DV', type: 'video_stream', size: 'NTP' }
      ]
    };
    const { textFilesets, audioFilesets } = selectFilesets(filesets);
    expect(textFilesets).toEqual([
      { id: 'ENGESVN_ET', type: 'text_plain', size: 'NT' },
      { id: 'ENGESVO_ET', type: 'text_plain', size: 'OT' }
    ]);
    expect(audioFilesets.map(f => f.id)).toEqual(['ENGESVN1DA', 'ENGESVN2DA']);
  });

  it('falls back to text_format only when no text_plain exists', () => {
    const filesets = { 'dbp-prod': [{ id: 'F', type: 'text_format', size: 'C' }] };
    expect(selectFilesets(filesets).textFilesets).toEqual([{ id: 'F', type: 'text_format', size: 'C' }]);
  });

  it('reads the documented set_type_code / set_size_code keys too', () => {
    const filesets = {
      'dbp-prod': [
        { id: 'T', set_type_code: 'text_plain', set_size_code: 'C' },
        { id: 'A', set_type_code: 'audio', set_size_code: 'NT' }
      ]
    };
    const { textFilesets, audioFilesets } = selectFilesets(filesets);
    expect(textFilesets).toEqual([{ id: 'T', type: 'text_plain', size: 'C' }]);
    expect(audioFilesets).toEqual([{ id: 'A', type: 'audio', size: 'NT' }]);
  });

  it('returns no text filesets when there is no readable text', () => {
    const filesets = { 'dbp-prod': [{ id: 'A', type: 'audio', size: 'C' }] };
    expect(selectFilesets(filesets).textFilesets).toEqual([]);
  });
});

describe('filesetCoversTestament', () => {
  it('complete/portions/single/blank cover either testament', () => {
    for (const size of ['C', 'P', 'S', '']) {
      expect(filesetCoversTestament(size, true)).toBe(true);
      expect(filesetCoversTestament(size, false)).toBe(true);
    }
  });
  it('NT/OT codes cover only their testament', () => {
    expect(filesetCoversTestament('NT', true)).toBe(true);
    expect(filesetCoversTestament('NT', false)).toBe(false);
    expect(filesetCoversTestament('OT', false)).toBe(true);
    expect(filesetCoversTestament('OT', true)).toBe(false);
    expect(filesetCoversTestament('NTOTP', true)).toBe(true);
    expect(filesetCoversTestament('NTOTP', false)).toBe(true);
  });
});

describe('selectTextFileset (NT/OT split)', () => {
  const split = [
    { id: 'ENGESVO_ET', type: 'text_plain', size: 'OT' },
    { id: 'ENGESVN_ET', type: 'text_plain', size: 'NT' }
  ];
  it('routes an NT book (JN) to the NT text fileset', () => {
    expect(selectTextFileset(split, 'JN').id).toBe('ENGESVN_ET');
  });
  it('routes an OT book (GN) to the OT text fileset', () => {
    expect(selectTextFileset(split, 'GN').id).toBe('ENGESVO_ET');
  });
  it('a complete fileset serves every book', () => {
    const complete = [{ id: 'C', type: 'text_plain', size: 'C' }];
    expect(selectTextFileset(complete, 'JN').id).toBe('C');
    expect(selectTextFileset(complete, 'GN').id).toBe('C');
  });
  it('returns null when no fileset covers the book (NT-only text, OT book)', () => {
    const ntOnly = [{ id: 'ENGESVN_ET', type: 'text_plain', size: 'NT' }];
    expect(selectTextFileset(ntOnly, 'GN')).toBeNull();
    expect(selectTextFileset([], 'JN')).toBeNull();
  });
});

describe('entryToTextInfo', () => {
  const entry = {
    abbr: 'ENGESV',
    name: 'English Standard Version',
    vname: 'English Standard Version',
    language: 'English',
    iso: 'eng',
    filesets: {
      'dbp-prod': [
        { id: 'ENGESVN_ET', type: 'text_plain', size: 'NT' },
        { id: 'ENGESVO_ET', type: 'text_plain', size: 'OT' },
        { id: 'ENGESVN2DA', type: 'audio_drama', size: 'NT' }
      ]
    }
  };

  it('maps a catalog entry into an app textInfo with a biblebrain block', () => {
    const info = entryToTextInfo(entry);
    expect(info).toMatchObject({
      type: 'bible',
      id: 'ENGESV',
      abbr: 'ENGESV',
      lang: 'eng',
      langName: 'English'
    });
    expect(info.biblebrain).toEqual({
      bibleId: 'ENGESV',
      textFilesets: [
        { id: 'ENGESVN_ET', type: 'text_plain', size: 'NT' },
        { id: 'ENGESVO_ET', type: 'text_plain', size: 'OT' }
      ],
      audioFilesets: [{ id: 'ENGESVN2DA', type: 'audio_drama', size: 'NT' }]
    });
  });

  it('returns null for an audio-only bible (no text fileset)', () => {
    const audioOnly = { ...entry, filesets: { 'dbp-prod': [{ id: 'X', type: 'audio', size: 'C' }] } };
    expect(entryToTextInfo(audioOnly)).toBeNull();
  });

  it('flags hasAudio so the chooser/AudioWindow can discover the audio', () => {
    // entry carries ENGESVN2DA (audio_drama)
    expect(entryToTextInfo(entry).hasAudio).toBe(true);
  });

  it('sets hasAudio false for a text-only bible (no audio fileset)', () => {
    const textOnly = { ...entry, filesets: { 'dbp-prod': [{ id: 'T', type: 'text_plain', size: 'C' }] } };
    expect(entryToTextInfo(textOnly).hasAudio).toBe(false);
  });
});

describe('normalizeChapters', () => {
  it('accepts a number array', () => {
    expect(normalizeChapters([1, 2, 3])).toEqual([1, 2, 3]);
  });
  it('accepts a comma string', () => {
    expect(normalizeChapters('1, 2, 3')).toEqual([1, 2, 3]);
  });
  it('drops non-positive / non-numeric values', () => {
    expect(normalizeChapters([0, 'x', 4])).toEqual([4]);
    expect(normalizeChapters(undefined)).toEqual([]);
  });
});

describe('versesToHtml', () => {
  const ctx = {
    textid: 'ENGESV', sectionid: 'JN3', bookid: 'JN', chapter: '3',
    lang: 'eng', dir: 'ltr', title: 'John', previd: 'JN2', nextid: 'JN4'
  };

  it('emits a section wrapper with nav data and verse spans', () => {
    const verses = [
      { verse_start: 16, verse_text: 'For God so loved the world' },
      { verse_start: 17, verse_text: 'God did not send' }
    ];
    const html = versesToHtml(verses, { ...ctx, chapter: '3' });
    expect(html).toContain('data-id="JN3"');
    expect(html).toContain('data-nextid="JN4"');
    expect(html).toContain('data-previd="JN2"');
    expect(html).toContain('<span class="v-num v-16">16</span>');
    expect(html).toContain('<span class="v JN3_16" data-id="JN3_16">For God so loved the world</span>');
  });

  it('shows the book title only on chapter 1', () => {
    const v = [{ verse_start: 1, verse_text: 'x' }];
    expect(versesToHtml(v, { ...ctx, chapter: '1', sectionid: 'JN1' })).toContain('<div class="mt">John</div>');
    expect(versesToHtml(v, { ...ctx, chapter: '3' })).not.toContain('<div class="mt">');
  });

  it('escapes HTML in verse text', () => {
    const v = [{ verse_start: 1, verse_text: 'a < b & c' }];
    expect(versesToHtml(v, ctx)).toContain('a &lt; b &amp; c');
  });
});

describe('extractSearchVerses', () => {
  it('reads the documented data.verses.data shape', () => {
    const json = { data: { verses: { data: [{ book_id: 'JHN' }] }, meta: {} } };
    expect(extractSearchVerses(json)).toEqual([{ book_id: 'JHN' }]);
  });
  it('falls back to verses.data', () => {
    expect(extractSearchVerses({ verses: { data: [{ book_id: 'MAT' }] } })).toEqual([{ book_id: 'MAT' }]);
  });
  it('falls back to a bare data array', () => {
    expect(extractSearchVerses({ data: [{ book_id: 'LUK' }] })).toEqual([{ book_id: 'LUK' }]);
  });
  it('returns [] when nothing matches', () => {
    expect(extractSearchVerses({})).toEqual([]);
  });
  it('skips a non-array data.verses object (verses present, verses.data absent)', () => {
    // Caller does for..of, so a non-array must not leak through.
    expect(extractSearchVerses({ data: { verses: { pagination: { total: 0 } } } })).toEqual([]);
  });
  it('returns the first array-valued candidate even when an earlier one is a non-array object', () => {
    const json = { data: { verses: {} }, verses: { data: [{ book_id: 'ROM' }] } };
    expect(extractSearchVerses(json)).toEqual([{ book_id: 'ROM' }]);
  });
});
