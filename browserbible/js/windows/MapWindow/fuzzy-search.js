/**
 * Fuzzy Search Utilities
 * Jaro-Winkler similarity algorithm for location search
 */

import { Reference } from '../../bible/BibleReference.js';

const findMatches = (s1, s2, matchWindow) => {
  const len1 = s1.length;
  const len2 = s2.length;
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (matches2[j] || s1[i] !== s2[j]) continue;
      matches1[i] = matches2[j] = true;
      matches++;
      break;
    }
  }

  return { matches1, matches2, matches };
};

const countTranspositions = (s1, matches1, s2, matches2) => {
  let transpositions = 0;
  let k = 0;

  for (let i = 0; i < s1.length; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return transpositions;
};

const calculateCommonPrefix = (s1, s2, maxLength = 4) => {
  let prefix = 0;
  const limit = Math.min(maxLength, Math.min(s1.length, s2.length));

  for (let i = 0; i < limit; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return prefix;
};

/**
 * Jaro-Winkler similarity algorithm for fuzzy string matching
 * Returns a value between 0 (no match) and 1 (exact match)
 */
const jaroWinkler = (s1, s2) => {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const { matches1, matches2, matches } = findMatches(s1, s2, matchWindow);

  if (matches === 0) return 0;

  const transpositions = countTranspositions(s1, matches1, s2, matches2);
  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
  const prefix = calculateCommonPrefix(s1, s2);

  return jaro + prefix * 0.1 * (1 - jaro);
};

/**
 * Score a single name against the (lowercased) query.
 * Exact match 2, prefix 1.5+, contains 1+, otherwise Jaro-Winkler above 0.7.
 * @returns {number} 0 when the name doesn't match at all
 */
const scoreName = (queryLower, name) => {
  const nameLower = name.toLowerCase();

  if (nameLower === queryLower) return 2;
  if (nameLower.startsWith(queryLower)) return 1.5 + jaroWinkler(queryLower, nameLower);
  if (nameLower.includes(queryLower)) return 1 + jaroWinkler(queryLower, nameLower);

  const score = jaroWinkler(queryLower, nameLower);
  return score > 0.7 ? score : 0;
};

// Alternate-name hits rank just below equally-good primary-name hits
const ALT_NAME_PENALTY = 0.95;

/**
 * Search locations by name (and optional altNames) with fuzzy matching.
 * @returns {{ results: Array<{location: Object, altName: string|null}>, total: number }}
 *   results - the top matches, best first; altName is set when the hit was an alternate name
 *   total - how many locations matched overall (for "N more results" UI)
 */
export const searchLocations = (query, locations, limit = 8) => {
  if (!query || !locations) return { results: [], total: 0 };

  const queryLower = query.toLowerCase();
  const matched = [];

  for (const location of locations) {
    let score = scoreName(queryLower, location.name);
    let altName = null;

    for (const alt of location.altNames || []) {
      const altScore = scoreName(queryLower, alt) * ALT_NAME_PENALTY;
      if (altScore > score) {
        score = altScore;
        altName = alt;
      }
    }

    if (score > 0) matched.push({ location, score, altName });
  }

  // Sort by score descending, then by verse count for ties
  matched.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    return (b.location.verses?.length || 0) - (a.location.verses?.length || 0);
  });

  return {
    results: matched.slice(0, limit).map(({ location, altName }) => ({ location, altName })),
    total: matched.length
  };
};

/**
 * Search locations with fuzzy matching.
 * Returns the matching locations sorted by relevance (legacy shape).
 */
export const fuzzySearchLocations = (query, locations, limit = 8) =>
  searchLocations(query, locations, limit).results.map(r => r.location);

/**
 * Try to read the query as a Bible reference ("John 3", "GN12", "1 Kings 8").
 * @returns {string|null} A section id like "JN3", or null when the query isn't a reference
 */
export const parseReferenceQuery = (query) => {
  if (!query || !/\d/.test(query)) return null;
  const ref = Reference(query.trim());
  if (!ref?.bookid || !(ref.chapter1 >= 1)) return null;
  return ref.bookid + ref.chapter1;
};
