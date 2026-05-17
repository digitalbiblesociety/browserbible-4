import { describe, it, expect } from 'vitest';

describe('vitest wiring', () => {
  it('jsdom global document is available', () => {
    expect(typeof document).toBe('object');
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
  });

  it('aliases resolve', async () => {
    const mod = await import('@bible/BibleData.js');
    expect(mod.BOOK_DATA.JN.names.eng).toContain('John');
  });
});
