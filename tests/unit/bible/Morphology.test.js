import { describe, it, expect } from 'vitest';
import { robinson, OSHB, Greek, Hebrew, morphology } from '@bible/Morphology.js';

describe('robinson (Greek) — verbs', () => {
  it('formats a 5-char tense/voice/mood/person/number', () => {
    expect(robinson.format('V-PAI-3S')).toBe('verb: present, active, indicative, 3rd, singular');
  });

  it('formats a 6-char participle (case/number/gender)', () => {
    // Present, active, participle, nominative, singular, masculine
    expect(robinson.format('V-PAP-NSM')).toBe('verb: present, active, participle, nominative, singular, masculine');
  });

  it('formats infinitive (2 chars after tense)', () => {
    // Present active infinitive
    expect(robinson.format('V-PAN')).toBe('verb: present, active, infinitive');
  });

  it('handles two-char tense (e.g. 2 aorist)', () => {
    expect(robinson.format('V-2AAI-3S')).toBe('verb: second aorist, active, indicative, 3rd, singular');
  });
});

describe('robinson — nouns and adjectives', () => {
  it('formats a noun (case, number, gender)', () => {
    expect(robinson.format('N-NSM')).toBe('noun: nominative, singular, masculine');
  });

  it('formats an article', () => {
    expect(robinson.format('T-NSF')).toBe('article: nominative, singular, feminine');
  });

  it('formats an adjective (case, number)', () => {
    expect(robinson.format('A-NS')).toBe('adjective: nominative, singular');
  });
});

describe('robinson — pronouns', () => {
  it('formats personal pronoun with person', () => {
    expect(robinson.format('P-1NS')).toBe('personal pronoun: 1st, nominative, singular');
    expect(robinson.format('P-2GP')).toBe('personal pronoun: 2nd, genitive, plural');
  });

  it('falls back to noun-like parsing when no person prefix', () => {
    expect(robinson.format('P-NSM')).toBe('personal pronoun: nominative, singular, masculine');
  });
});

describe('robinson — particles, conjunctions, indeclinables', () => {
  it('formats interrogative particle PRT-I', () => {
    expect(robinson.format('PRT-I')).toBe('particle: interogative');
  });

  it('returns a part of speech for non-parsing keys', () => {
    expect(robinson.format('CONJ')).toBe('conjunction');
  });

  it('returns the raw remainder when part of speech is unknown', () => {
    expect(robinson.format('ZZ-XYZ')).toBe('XYZ');
  });
});

describe('robinson — getPartofSpeech', () => {
  it('returns the readable name', () => {
    expect(robinson.getPartofSpeech('V')).toBe('verb');
    expect(robinson.getPartofSpeech('CONJ')).toBe('conjunction');
  });

  it('returns "?" when unknown', () => {
    expect(robinson.getPartofSpeech('ZZ')).toBe('?');
  });
});

describe('OSHB (Hebrew) — verbs', () => {
  it('formats a Hebrew qal perfect 3ms', () => {
    expect(OSHB.format('HVqp3ms')).toBe('verb: qal, perfect (qatal), third, masculine, singular');
  });

  it('formats Hebrew imperfect with state', () => {
    // Hebrew, verb, niphal, imperfect, 3rd, masculine, singular
    expect(OSHB.format('HVNi3ms')).toBe('verb: niphal, imperfect (yiqtol), third, masculine, singular');
  });

  it('formats Aramaic verb', () => {
    expect(OSHB.format('AVqp3ms')).toBe('verb: peal, perfect (qatal), third, masculine, singular');
  });
});

describe('OSHB — non-verb parts of speech', () => {
  it('formats a Hebrew noun', () => {
    expect(OSHB.format('HNcfsa')).toBe('noun: common, feminine, singular, absolute');
  });

  it('formats a Hebrew adjective', () => {
    expect(OSHB.format('HAams')).toBe('adjective: adjective, masculine, singular');
  });

  it('formats a Hebrew preposition', () => {
    expect(OSHB.format('HRd')).toBe('preposition: definite article');
  });

  it('formats a Hebrew pronoun', () => {
    expect(OSHB.format('HPp3ms')).toBe('pronoun: personal, third, masculine, singular');
  });

  it('formats a Hebrew suffix', () => {
    expect(OSHB.format('HSp3ms')).toBe('suffix: pronominal, third, masculine, singular');
  });

  it('joins multi-segment morphology with semicolons', () => {
    // Hebrew preposition + noun
    expect(OSHB.format('HRd/Ncfsa')).toBe('preposition: definite article; noun: common, feminine, singular, absolute');
  });
});

describe('exports', () => {
  it('Greek alias points at robinson', () => {
    expect(Greek).toBe(robinson);
  });

  it('Hebrew alias points at OSHB', () => {
    expect(Hebrew).toBe(OSHB);
  });

  it('default morphology bundle exposes both parsers', () => {
    expect(morphology.robinson).toBe(robinson);
    expect(morphology.OSHB).toBe(OSHB);
  });
});
