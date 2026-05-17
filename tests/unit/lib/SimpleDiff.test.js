import { describe, it, expect } from 'vitest';
import { diffWords } from '@lib/SimpleDiff.js';
import diffDefault from '@lib/SimpleDiff.js';

describe('diffWords', () => {
  it('identical strings produce a single same-part', () => {
    const parts = diffWords('hello world', 'hello world');
    expect(parts).toEqual([{ value: 'hello world' }]);
  });

  it('marks added words', () => {
    const parts = diffWords('hello world', 'hello big world');
    expect(parts.find(p => p.added)?.value.trim()).toBe('big');
    expect(parts.some(p => p.removed)).toBe(false);
  });

  it('marks removed words', () => {
    const parts = diffWords('hello big world', 'hello world');
    expect(parts.find(p => p.removed)?.value.trim()).toBe('big');
    expect(parts.some(p => p.added)).toBe(false);
  });

  it('reconstructs the original strings from the diff', () => {
    const oldText = 'the quick brown fox jumps over the lazy dog';
    const newText = 'the slow brown cat jumps over a lazy dog';
    const parts = diffWords(oldText, newText);

    const reconstructedOld = parts
      .filter(p => !p.added)
      .map(p => p.value)
      .join('');
    const reconstructedNew = parts
      .filter(p => !p.removed)
      .map(p => p.value)
      .join('');

    expect(reconstructedOld).toBe(oldText);
    expect(reconstructedNew).toBe(newText);
  });

  it('preserves whitespace in tokenization', () => {
    const parts = diffWords('a  b', 'a  b');
    expect(parts.map(p => p.value).join('')).toBe('a  b');
  });

  it('handles empty strings on both sides', () => {
    expect(diffWords('', '')).toEqual([]);
  });

  it('treats a deletion-only diff as fully removed', () => {
    const parts = diffWords('foo', '');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ value: 'foo', removed: true });
  });

  it('treats an insertion-only diff as fully added', () => {
    const parts = diffWords('', 'foo');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ value: 'foo', added: true });
  });

  it('default export exposes diffWords', () => {
    expect(diffDefault.diffWords).toBe(diffWords);
  });
});
