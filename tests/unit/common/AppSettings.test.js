import { describe, it, expect, beforeEach } from 'vitest';
import { AppSettings } from '@common/AppSettings.js';

describe('AppSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns the defaults when nothing is stored', () => {
    const value = AppSettings.getValue('window-1', { color: 'blue', size: 12 });
    expect(value).toEqual({ color: 'blue', size: 12 });
  });

  it('returns {} when no key, no value, no defaults', () => {
    expect(AppSettings.getValue('untouched')).toEqual({});
  });

  it('round-trips a value through localStorage', () => {
    AppSettings.setValue('w1', { ref: 'JN3_16', font: 'serif' });
    const value = AppSettings.getValue('w1', { font: 'sans' });
    expect(value).toEqual({ ref: 'JN3_16', font: 'serif' });
  });

  it('merges stored value over defaults (stored wins)', () => {
    AppSettings.setValue('w2', { font: 'serif' });
    expect(AppSettings.getValue('w2', { font: 'sans', size: 14 })).toEqual({ font: 'serif', size: 14 });
  });

  it('removeValue clears the stored entry', () => {
    AppSettings.setValue('w3', { ref: 'JN3' });
    AppSettings.removeValue('w3');
    expect(AppSettings.getValue('w3', { ref: 'GN1' })).toEqual({ ref: 'GN1' });
  });

  it('uses the configured prefix in localStorage', () => {
    AppSettings.setValue('w4', { x: 1 });
    const keys = Object.keys(window.localStorage);
    expect(keys.some(k => k.endsWith('w4'))).toBe(true);
  });

  it('returns defaults when stored value is malformed JSON', () => {
    AppSettings.setValue('w5', { ok: true });
    const fullKey = Object.keys(window.localStorage).find(k => k.endsWith('w5'));
    window.localStorage.setItem(fullKey, '{not json');
    expect(AppSettings.getValue('w5', { ok: false })).toEqual({ ok: false });
  });
});
