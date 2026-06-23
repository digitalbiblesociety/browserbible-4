import { describe, it, expect } from 'vitest';
import { SearchTools, TextSearch } from '@texts/Search.js';

describe('SearchTools.createLemmaHighlightRegExps', () => {
  const matches = (searchText, sAttr) =>
    SearchTools.createLemmaHighlightRegExps(searchText).some((re) => re.test(sAttr));

  it('matches a Strong\'s number as a whole token within a multi-number s attribute', () => {
    expect(matches('G25', 'G25')).toBe(true);
    expect(matches('G25', 'G3588 G25')).toBe(true);
    expect(matches('G25', 'G25 G3588')).toBe(true);
  });

  it('does not match a number that is only a prefix of a longer number', () => {
    expect(matches('G25', 'G250')).toBe(false);
    expect(matches('G25', 'G2500 G1063')).toBe(false);
  });

  it('matches Hebrew numbers and tolerates an a/b sense suffix', () => {
    expect(matches('H430', 'H853 H430')).toBe(true);
    expect(matches('H430', 'H430a')).toBe(true);
  });

  it('matches regardless of whether the s attribute carries a G/H prefix', () => {
    expect(matches('G25', '25')).toBe(true);
    expect(matches('G25', '3588 25')).toBe(true);
  });

  it('builds one regex per searched number and ignores non-Strong tokens', () => {
    expect(SearchTools.createLemmaHighlightRegExps('G25 H430')).toHaveLength(2);
    expect(SearchTools.createLemmaHighlightRegExps('love')).toHaveLength(0);
    expect(SearchTools.createLemmaHighlightRegExps('')).toHaveLength(0);
  });
});

describe('SearchTools.createSearchTerms (lemma detection regex)', () => {
  it('matches a real s="..." attribute (regression for the quote-class typo)', () => {
    const [re] = SearchTools.createSearchTerms('G25', true);
    re.lastIndex = 0;
    expect(re.test('<l s="G3588 G25">x</l>')).toBe(true);
    re.lastIndex = 0;
    expect(re.test("<l s='G25'>x</l>")).toBe(true);
    re.lastIndex = 0;
    expect(re.test('<l s="G250">x</l>')).toBe(false);
  });
});

describe('TextSearch.findMatchesInVerse', () => {
  // Isolate the match/highlight branch with a regex we control; the lemma
  // detection-regex builder is a separate, pre-existing concern.
  const lemmaSearch = (regexps) => {
    const ts = new TextSearch();
    ts.isLemmaSearch = true;
    ts.searchType = 'AND';
    ts.searchTermsRegExp = regexps;
    return ts;
  };

  const textSearch = (searchText) => {
    const ts = new TextSearch();
    ts.isLemmaSearch = false;
    ts.searchType = 'AND';
    ts.searchTermsRegExp = SearchTools.createSearchTerms(searchText, false);
    return ts;
  };

  it('detects a lemma match without altering the verse markup', () => {
    const html = '<l s="G3588 G25" m="V">ἠγάπησεν</l> <l s="G1063">γὰρ</l>';
    const result = lemmaSearch([/s="[^"]*\bG25\b[^"]*"/gi]).findMatchesInVerse(html);

    expect(result.foundMatch).toBe(true);
    // Lemma highlighting happens in the DOM, so the markup must be untouched
    // (the old code injected a broken `class="highlight"` string here).
    expect(result.html).toBe(html);
    expect(result.html).not.toContain('class="highlight"');
  });

  it('reports no match when the lemma is absent', () => {
    const html = '<l s="G1063">γὰρ</l>';
    expect(lemmaSearch([/s="[^"]*\bG25\b[^"]*"/gi]).findMatchesInVerse(html).foundMatch).toBe(false);
  });

  it('still wraps matched words in a highlight span for a normal text search', () => {
    const result = textSearch('love').findMatchesInVerse('God is love');

    expect(result.foundMatch).toBe(true);
    expect(result.html).toBe('God is <span class="highlight">love</span>');
  });
});
