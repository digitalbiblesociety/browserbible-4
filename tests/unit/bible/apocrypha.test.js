import { describe, it, expect } from 'vitest';
import {
  isApocryphalBook,
  isApocryphalSection,
  filterVisibleBooks,
  skipApocryphalSection,
  getShowApocrypha,
  setShowApocrypha,
  isApocryphaHidden,
  onApocryphaChange,
} from '@bible/Apocrypha.js';

describe('apocrypha classification', () => {
  it('identifies apocryphal book codes', () => {
    expect(isApocryphalBook('TB')).toBe(true);  // Tobit
    expect(isApocryphalBook('SR')).toBe(true);  // Sirach
    expect(isApocryphalBook('GN')).toBe(false); // Genesis
    expect(isApocryphalBook('MT')).toBe(false); // Matthew
    expect(isApocryphalBook('RV')).toBe(false); // Revelation
  });

  it('identifies apocryphal sections by their book prefix', () => {
    expect(isApocryphalSection('TB1')).toBe(true);
    expect(isApocryphalSection('M21')).toBe(true);  // 2 Maccabees 1 (M2 + 1)
    expect(isApocryphalSection('GN1')).toBe(false);
    expect(isApocryphalSection('')).toBe(false);
    expect(isApocryphalSection(undefined)).toBe(false);
  });
});

describe('apocrypha setting (default off)', () => {
  // These run before any setShowApocrypha(true), so they exercise the default.
  it('defaults to hidden', () => {
    expect(getShowApocrypha()).toBe(false);
    expect(isApocryphaHidden()).toBe(true);
  });

  it('filterVisibleBooks strips apocryphal entries while hidden', () => {
    expect(filterVisibleBooks(['GN', 'TB', 'MT', 'SR', 'RV'])).toEqual(['GN', 'MT', 'RV']);
    // works on section ids too
    expect(filterVisibleBooks(['GN1', 'TB1', 'MT5'])).toEqual(['GN1', 'MT5']);
  });
});

describe('skipApocryphalSection (scroll skipping)', () => {
  // OT→AP→NT block ordering (e.g. Brenton Septuagint): Malachi → Tobit… → Matthew
  const blockOrder = ['ML4', 'TB1', 'TB2', 'JT1', 'MT1', 'MT2'];

  it('returns the id unchanged when it is not apocryphal', () => {
    expect(skipApocryphalSection('ML4', 1, blockOrder)).toBe('ML4');
    expect(skipApocryphalSection('MT1', -1, blockOrder)).toBe('MT1');
  });

  it('skips forward over a run of apocryphal sections to the next book', () => {
    expect(skipApocryphalSection('TB1', 1, blockOrder)).toBe('MT1');
  });

  it('skips backward over a run of apocryphal sections to the previous book', () => {
    expect(skipApocryphalSection('JT1', -1, blockOrder)).toBe('ML4');
  });

  it('handles apocrypha interspersed in the OT (Catholic order)', () => {
    // Nehemiah → Tobit, Judith → Esther
    const interspersed = ['NH13', 'TB1', 'JT1', 'ET1'];
    expect(skipApocryphalSection('TB1', 1, interspersed)).toBe('ET1');
    expect(skipApocryphalSection('JT1', -1, interspersed)).toBe('NH13');
  });

  it('returns null when the run reaches the end of the text', () => {
    expect(skipApocryphalSection('TB1', 1, ['ML4', 'TB1', 'TB2'])).toBe(null);
    expect(skipApocryphalSection('TB1', -1, ['TB1', 'TB2', 'MT1'])).toBe(null);
  });

  it('returns the id unchanged when not found or no section list', () => {
    expect(skipApocryphalSection('TB1', 1, ['GN1', 'MT1'])).toBe('TB1');
    expect(skipApocryphalSection('TB1', 1, null)).toBe('TB1');
  });
});

describe('toggling the setting', () => {
  it('emits a change event and updates the getters', () => {
    let received = null;
    onApocryphaChange((e) => { received = e.data.showApocrypha; });

    setShowApocrypha(true);
    expect(received).toBe(true);
    expect(getShowApocrypha()).toBe(true);
    expect(isApocryphaHidden()).toBe(false);

    // filter is a no-op when apocrypha is shown
    expect(filterVisibleBooks(['GN', 'TB', 'MT'])).toEqual(['GN', 'TB', 'MT']);
  });

  it('does not re-emit when the value is unchanged', () => {
    let count = 0;
    onApocryphaChange(() => { count++; });
    setShowApocrypha(true); // already true from previous test
    expect(count).toBe(0);
  });

  it('can be turned back off', () => {
    setShowApocrypha(false);
    expect(getShowApocrypha()).toBe(false);
    expect(filterVisibleBooks(['GN', 'TB', 'MT'])).toEqual(['GN', 'MT']);
  });
});
