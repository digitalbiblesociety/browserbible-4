import { describe, it, expect } from 'vitest';
import { notesToMarkdown, notesToPlainText, notesToRtf, notesToJson } from '@windows/NotesWindow/download.js';
import { parseImportedFile } from '@windows/NotesWindow/upload.js';
import { refToLocation } from '@windows/NotesWindow/references.js';
import { SCHEMA_VERSION } from '@windows/NotesWindow/NotesStore.js';

function makeNote(overrides = {}) {
  return {
    id: 'note_test1',
    title: 'Grace Study',
    content: '<h2>Heading</h2><p>Some <strong>bold</strong> text</p>',
    reference: 'JN3_16',
    referenceDisplay: 'John 3:16',
    pinned: true,
    created: 1700000000000,
    modified: 1700000100000,
    ...overrides
  };
}

describe('markdown round-trip', () => {
  it('re-imports title, content, and the verse link as a fragmentid', () => {
    const exported = notesToMarkdown([makeNote()]);
    const { notes, mode } = parseImportedFile(exported, 'notes.md');

    expect(mode).toBe('add');
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Grace Study');
    expect(notes[0].content).toContain('<strong>bold</strong>');
    expect(notes[0].content).toContain('<h2>Heading</h2>');
    // The old importer stored the display string here, so the
    // current-verse filter never matched imported notes.
    expect(notes[0].reference).toBe('JN3_16');
    expect(notes[0].referenceDisplay).toBe('John 3:16');
    expect(notes[0].id).not.toBe('note_test1'); // text imports get fresh ids
  });

  it('handles multiple notes', () => {
    const exported = notesToMarkdown([
      makeNote({ title: 'One' }),
      makeNote({ title: 'Two', reference: null, referenceDisplay: null })
    ]);
    const { notes } = parseImportedFile(exported, 'notes.md');
    expect(notes.map((n) => n.title)).toEqual(['One', 'Two']);
    expect(notes[1].reference).toBeNull();
  });
});

describe('plain text round-trip', () => {
  it('re-imports title, content, and the verse link as a fragmentid', () => {
    const exported = notesToPlainText([makeNote()]);
    const { notes, mode } = parseImportedFile(exported, 'notes.txt');

    expect(mode).toBe('add');
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Grace Study');
    expect(notes[0].reference).toBe('JN3_16');
    expect(notes[0].content).toContain('bold');
  });
});

describe('rtf round-trip', () => {
  it('re-imports title and the verse link as a fragmentid', () => {
    const exported = notesToRtf([makeNote()]);
    const { notes, mode } = parseImportedFile(exported, 'notes.rtf');

    expect(mode).toBe('add');
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Grace Study');
    expect(notes[0].reference).toBe('JN3_16');
  });
});

describe('unparseable references', () => {
  it('keeps the display text but does not fake a link', () => {
    const exported = notesToMarkdown([makeNote({ referenceDisplay: 'Not A Book 99:1' })]);
    const { notes } = parseImportedFile(exported, 'notes.md');
    expect(notes[0].reference).toBeNull();
    expect(notes[0].referenceDisplay).toBe('Not A Book 99:1');
  });
});

describe('JSON backup round-trip', () => {
  it('preserves ids, pin state, timestamps, and links exactly', () => {
    const original = makeNote();
    const { notes, mode } = parseImportedFile(notesToJson([original]), 'backup.json');

    expect(mode).toBe('merge');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual(original);
  });

  it('sanitizes content on the way in', () => {
    const dirty = makeNote({ content: '<p>ok</p><script>alert(1)</script>' });
    const { notes } = parseImportedFile(notesToJson([dirty]), 'backup.json');
    expect(notes[0].content).toBe('<p>ok</p>');
  });

  it('accepts a bare array payload', () => {
    const { notes } = parseImportedFile(JSON.stringify([makeNote()]), 'backup.json');
    expect(notes).toHaveLength(1);
  });

  it('includes the schema version in exports', () => {
    const payload = JSON.parse(notesToJson([makeNote()]));
    expect(payload.version).toBe(SCHEMA_VERSION);
    expect(payload.exportedAt).toBeTruthy();
  });

  it('rejects malformed or non-backup JSON cleanly', () => {
    expect(() => parseImportedFile('{oops', 'backup.json')).toThrow();
    expect(() => parseImportedFile('"a string"', 'backup.json')).toThrow();
    expect(() => parseImportedFile('{"foo": 1}', 'backup.json')).toThrow();
  });

  it('drops unusable entries instead of failing the whole restore', () => {
    const payload = JSON.stringify({ notes: [makeNote(), null, 'junk'] });
    const { notes } = parseImportedFile(payload, 'backup.json');
    expect(notes).toHaveLength(1);
  });
});

describe('refToLocation', () => {
  it('maps a chapter:verse reference', () => {
    expect(refToLocation('John', '3:16')).toEqual({
      sectionid: 'JN3',
      fragmentid: 'JN3_16',
      startVerse: 16,
      endVerse: 16
    });
  });

  it('maps a verse range to its start fragment with the end verse kept', () => {
    expect(refToLocation('John', '3:16-18')).toEqual({
      sectionid: 'JN3',
      fragmentid: 'JN3_16',
      startVerse: 16,
      endVerse: 18
    });
  });

  it('maps a chapter-only reference', () => {
    const loc = refToLocation('Psalms', '23');
    expect(loc.fragmentid).toBe(loc.sectionid);
    expect(loc.startVerse).toBeNull();
  });

  it('returns null for unknown books or garbage references', () => {
    expect(refToLocation('Narnia', '3:16')).toBeNull();
    expect(refToLocation('John', 'xyz')).toBeNull();
  });
});
