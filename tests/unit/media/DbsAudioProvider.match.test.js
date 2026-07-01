import { describe, it, expect } from 'vitest';
import { dbsAudioMatches } from '@/media/DbsAudioProvider.js';

describe('dbsAudioMatches', () => {
  it('matches when the audio entry abbr equals the text id/abbr', () => {
    const audio = { id: 'ENGESV', abbr: 'ESV' };
    expect(dbsAudioMatches(audio, { id: 'ESV', abbr: 'ESV' })).toBe(true);
  });

  it('matches via davar_id when abbr differs (the NAV regression)', () => {
    const audio = { id: 'ARB-NAV', abbr: 'NAV', davar_id: 'ARBNAV' };
    expect(dbsAudioMatches(audio, { id: 'ARBNAV', abbr: 'ARBNAV' })).toBe(true);
  });

  it('matches via the audio entry id', () => {
    const audio = { id: 'ARBNAV', abbr: 'NAV' };
    expect(dbsAudioMatches(audio, { id: 'ARBNAV', abbr: 'ARBNAV' })).toBe(true);
  });

  it('falls back to text id when abbr is missing', () => {
    const audio = { id: 'X', abbr: 'NAV' };
    expect(dbsAudioMatches(audio, { id: 'NAV' })).toBe(true);
  });

  it('does not match unrelated entries', () => {
    const audio = { id: 'ARB-NAV', abbr: 'NAV', davar_id: 'ARBNAV' };
    expect(dbsAudioMatches(audio, { id: 'ENGESV', abbr: 'ESV' })).toBe(false);
  });
});
