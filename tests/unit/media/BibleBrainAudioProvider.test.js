import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  filesetCoversTestament,
  selectAudioFileset,
  parseTimestamps,
  BibleBrainAudioProvider
} from '@/media/BibleBrainAudioProvider.js';

describe('filesetCoversTestament', () => {
  it('complete / portions / single / blank cover either testament', () => {
    for (const size of ['C', 'P', 'S', '']) {
      expect(filesetCoversTestament(size, true)).toBe(true);
      expect(filesetCoversTestament(size, false)).toBe(true);
    }
  });

  it('NT codes cover NT only', () => {
    expect(filesetCoversTestament('NT', true)).toBe(true);
    expect(filesetCoversTestament('NT', false)).toBe(false);
    expect(filesetCoversTestament('NTP', false)).toBe(false);
  });

  it('OT codes cover OT only', () => {
    expect(filesetCoversTestament('OT', false)).toBe(true);
    expect(filesetCoversTestament('OT', true)).toBe(false);
  });

  it('combined codes cover both', () => {
    expect(filesetCoversTestament('NTOTP', true)).toBe(true);
    expect(filesetCoversTestament('NTOTP', false)).toBe(true);
  });
});

describe('selectAudioFileset', () => {
  const filesets = [
    { id: 'NT_DRAMA', type: 'audio_drama', size: 'NT' },
    { id: 'NT_PLAIN', type: 'audio', size: 'NT' },
    { id: 'OT_DRAMA', type: 'audio_drama', size: 'OT' }
  ];

  it('returns null with no filesets', () => {
    expect(selectAudioFileset([], 'JN', 'audio')).toBeNull();
    expect(selectAudioFileset(undefined, 'JN', 'audio')).toBeNull();
  });

  it('picks an NT fileset for an NT book (JN), preferring plain audio', () => {
    expect(selectAudioFileset(filesets, 'JN', 'audio').id).toBe('NT_PLAIN');
  });

  it('honors the drama preference for an NT book', () => {
    expect(selectAudioFileset(filesets, 'JN', 'drama').id).toBe('NT_DRAMA');
  });

  it('falls back to the other mode when the preferred one is missing', () => {
    expect(selectAudioFileset(filesets, 'GN', 'audio').id).toBe('OT_DRAMA');
  });

  it('returns null when no fileset covers the book testament', () => {
    const ntOnly = [{ id: 'NT_PLAIN', type: 'audio', size: 'NT' }];
    expect(selectAudioFileset(ntOnly, 'GN', 'audio')).toBeNull();
  });

  it('prefers the base fileset over a codec variant (timestamps + mp3)', () => {
    const variants = [
      { id: 'ENGESVN1DA-opus16', type: 'audio', size: 'NT' },
      { id: 'ENGESVN1DA', type: 'audio', size: 'NT' }
    ];
    expect(selectAudioFileset(variants, 'JN', 'audio').id).toBe('ENGESVN1DA');
  });

  it('skips an id-less fileset without throwing and picks a valid one', () => {
    const withMissingId = [
      { type: 'audio', size: 'NT' }, // no id — must not throw on .includes
      { id: 'NT_PLAIN', type: 'audio', size: 'NT' }
    ];
    expect(selectAudioFileset(withMissingId, 'JN', 'audio').id).toBe('NT_PLAIN');
  });

  it('does not throw when every covering fileset lacks an id', () => {
    const noIds = [{ type: 'audio', size: 'NT' }];
    expect(() => selectAudioFileset(noIds, 'JN', 'audio')).not.toThrow();
  });
});

describe('parseTimestamps', () => {
  it('maps verse_start/timestamp to {verse,time} and sorts by time', () => {
    const data = [
      { verse_start: 2, timestamp: 5.4 },
      { verse_start: 1, timestamp: 0 },
      { verse_start: 3, timestamp: 11.2 }
    ];
    expect(parseTimestamps(data)).toEqual([
      { verse: 1, time: 0 },
      { verse: 2, time: 5.4 },
      { verse: 3, time: 11.2 }
    ]);
  });

  it('drops malformed rows and returns null when empty', () => {
    expect(parseTimestamps([{ verse_start: 'x', timestamp: 'y' }])).toBeNull();
    expect(parseTimestamps(null)).toBeNull();
    expect(parseTimestamps([])).toBeNull();
  });
});

describe('BibleBrainAudioProvider navigation', () => {
  const provider = new BibleBrainAudioProvider();
  const audioInfo = { audioFilesets: [{ id: 'NT', type: 'audio', size: 'NT' }] };
  const textInfo = { sections: ['GN1', 'GN2', 'MT1', 'MT2', 'MK1'] };

  it('getNextFragment skips to the next chapter that has audio', async () => {
    expect(await provider.getNextFragment(textInfo, audioInfo, 'GN1_1')).toBe('MT1_1');
    expect(await provider.getNextFragment(textInfo, audioInfo, 'MT1_5')).toBe('MT2_1');
  });

  it('getPrevFragment skips backward over chapters without audio', async () => {
    expect(await provider.getPrevFragment(textInfo, audioInfo, 'MT2_1')).toBe('MT1_1');
    expect(await provider.getPrevFragment(textInfo, audioInfo, 'MT1_1')).toBeNull();
  });

  it('returns null past the ends', async () => {
    expect(await provider.getNextFragment(textInfo, audioInfo, 'MK1_1')).toBeNull();
  });

  it('does not probe the network for a complete fileset (size NT)', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await provider.getNextFragment(textInfo, audioInfo, 'GN1_1')).toBe('MT1_1');
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('BibleBrainAudioProvider navigation over a partial fileset', () => {
  const provider = new BibleBrainAudioProvider();
  // Partial fileset ('NTP'): _step must probe each candidate chapter for audio.
  const audioInfo = { audioFilesets: [{ id: 'NTP', type: 'audio', size: 'NTP' }] };
  const textInfo = { sections: ['MT1', 'MT2', 'MT3'] };

  afterEach(() => { vi.unstubAllGlobals(); });

  it('skips a partial-fileset chapter that has no audio file', async () => {
    // MT2 (MAT/2) has no audio file; MT3 does.
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: url.includes('/MAT/2') ? [] : [{ path: 'http://x/a.mp3' }] })
    })));
    expect(await provider.getNextFragment(textInfo, audioInfo, 'MT1_1')).toBe('MT3_1');
  });

  it('returns null when no remaining chapter has audio', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) })));
    expect(await provider.getNextFragment(textInfo, audioInfo, 'MT1_1')).toBeNull();
  });

  it('treats a fetch error as no audio and keeps looking', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))));
    expect(await provider.getNextFragment(textInfo, audioInfo, 'MT1_1')).toBeNull();
  });
});
