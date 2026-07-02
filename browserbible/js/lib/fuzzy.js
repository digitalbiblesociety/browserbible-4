/**
 * Fuzzy string matching (Jaro-Winkler) for filter inputs.
 *
 * Callers should try a plain substring match first and use these helpers to
 * catch typos that .includes() misses ("englsh" for "English").
 */

// Scores below this read as noise rather than a typo.
export const FUZZY_THRESHOLD = 0.86;

// 1-2 char queries mostly produce false positives, and substring matching
// already handles them.
const MIN_FUZZY_LENGTH = 3;

/** Jaro similarity: 0 (no match) to 1 (identical). */
function jaro(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (!len1 || !len2) return 0;

  // Canonical Jaro uses floor(max/2)-1, which is 0 for 3-char strings and
  // misses adjacent transpositions like "nwe"/"new". Floor the window at 1.
  const window = Math.max(1, Math.floor(Math.max(len1, len2) / 2) - 1);
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, len2);
    for (let k = start; k < end; k++) {
      if (matches2[k] || s1[i] !== s2[k]) continue;
      matches1[i] = true;
      matches2[k] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    matches / len1 +
    matches / len2 +
    (matches - transpositions) / matches
  ) / 3;
}

/**
 * Jaro-Winkler similarity: Jaro with a bonus for a shared prefix (up to
 * 4 chars), which suits the partially typed words a filter box sees.
 * @returns {number} 0 (no match) to 1 (identical)
 */
export function jaroWinkler(s1, s2) {
  const score = jaro(s1, s2);

  const maxPrefix = Math.min(4, s1.length, s2.length);
  let prefix = 0;
  while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix++;

  return score + prefix * 0.1 * (1 - score);
}

/**
 * True when `query` is a substring of `text` or fuzzy-matches one of `words`.
 * Inputs must already be lowercased.
 * @param {string} text - Full searchable string
 * @param {string[]} words - The same string split into words
 * @param {string} query - A single filter token
 */
export function fuzzyIncludes(text, words, query, threshold = FUZZY_THRESHOLD) {
  if (text.includes(query)) return true;
  if (query.length < MIN_FUZZY_LENGTH) return false;
  return words.some(word => jaroWinkler(query, word) >= threshold);
}

/**
 * [start, end) ranges in `text` to highlight for the given filter tokens:
 * each token's first substring occurrence, or the word it best fuzzy-matches.
 * Overlaps are merged; matching is case-insensitive.
 * @param {string} text - Display string (any casing)
 * @param {string[]} tokens - Lowercased filter tokens
 * @returns {Array<[number, number]>}
 */
export function matchRanges(text, tokens, threshold = FUZZY_THRESHOLD) {
  const lower = text.toLowerCase();
  const ranges = [];

  for (const token of tokens) {
    if (!token) continue;

    const index = lower.indexOf(token);
    if (index !== -1) {
      ranges.push([index, index + token.length]);
      continue;
    }
    if (token.length < MIN_FUZZY_LENGTH) continue;

    let best = null;
    for (const word of lower.matchAll(/\S+/g)) {
      const score = jaroWinkler(token, word[0]);
      if (score >= threshold && (!best || score > best.score)) {
        best = { start: word.index, end: word.index + word[0].length, score };
      }
    }
    if (best) ranges.push([best.start, best.end]);
  }

  if (ranges.length < 2) return ranges;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }
  return merged;
}
