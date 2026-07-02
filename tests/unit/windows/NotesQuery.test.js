import { describe, it, expect } from 'vitest';
import { filterAndSortNotes, searchNotes } from '@windows/NotesWindow/query.js';

function note(id, { title = id, reference = null, pinned = false, created = 0, modified = 0, plain = '' } = {}) {
  return { id, title, content: '', reference, referenceDisplay: reference, pinned, created, modified, _plain: plain };
}

const getPlainText = (notes) => (id) => notes.find((n) => n.id === id)?._plain || '';

describe('filterAndSortNotes', () => {
  const notes = [
    note('a', { reference: 'JN3_16', modified: 300 }),
    note('b', { modified: 200 }),
    note('c', { reference: 'RM8_28', modified: 100 })
  ];

  it('filters linked / standalone / current reference', () => {
    expect(filterAndSortNotes(notes, { filterMode: 'linked' }).map((n) => n.id)).toEqual(['a', 'c']);
    expect(filterAndSortNotes(notes, { filterMode: 'standalone' }).map((n) => n.id)).toEqual(['b']);
    expect(filterAndSortNotes(notes, { filterMode: 'reference', currentReference: 'RM8_28' }).map((n) => n.id)).toEqual(['c']);
  });

  it('reference mode matches nothing when there is no current reference', () => {
    expect(filterAndSortNotes(notes, { filterMode: 'reference', currentReference: null })).toEqual([]);
  });

  it('searches titles and plain-text content', () => {
    const searchable = [
      note('t1', { title: 'Grace and Peace' }),
      note('t2', { title: 'Other', plain: 'On grace abounding' }),
      note('t3', { title: 'Unrelated' })
    ];
    const result = filterAndSortNotes(searchable, { searchQuery: 'grace', getPlainText: getPlainText(searchable) });
    expect(result.map((n) => n.id).sort()).toEqual(['t1', 't2']);
  });

  it('sorts by modified desc by default, created desc and title asc on request', () => {
    const set = [
      note('x', { title: 'Charlie', created: 1, modified: 10 }),
      note('y', { title: 'alpha', created: 3, modified: 30 }),
      note('z', { title: 'Bravo', created: 2, modified: 20 })
    ];
    expect(filterAndSortNotes(set, {}).map((n) => n.id)).toEqual(['y', 'z', 'x']);
    expect(filterAndSortNotes(set, { sortMode: 'created' }).map((n) => n.id)).toEqual(['y', 'z', 'x']);
    expect(filterAndSortNotes(set, { sortMode: 'title' }).map((n) => n.id)).toEqual(['y', 'z', 'x']);
    expect(filterAndSortNotes(set, { sortMode: 'nonsense' }).map((n) => n.id)).toEqual(['y', 'z', 'x']);
  });

  it('puts pinned notes first, keeping the sort within each group', () => {
    const set = [
      note('p-old', { pinned: true, modified: 10 }),
      note('n-new', { modified: 40 }),
      note('p-new', { pinned: true, modified: 30 }),
      note('n-old', { modified: 20 })
    ];
    expect(filterAndSortNotes(set, {}).map((n) => n.id)).toEqual(['p-new', 'p-old', 'n-new', 'n-old']);
  });

  it('does not mutate the input array', () => {
    const set = [note('b', { modified: 1 }), note('a', { modified: 2 })];
    filterAndSortNotes(set, {});
    expect(set.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('searchNotes', () => {
  it('is case-insensitive and respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => note(`m${i}`, { title: `Match ${i}` }));
    expect(searchNotes(many, 'MATCH', undefined, 5)).toHaveLength(5);
  });

  it('returns nothing for a blank query', () => {
    expect(searchNotes([note('a')], '   ')).toEqual([]);
  });
});
