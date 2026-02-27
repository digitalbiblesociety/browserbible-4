/**
 * Fuzzy Search Utilities
 * Jaro-Winkler similarity algorithm for location search
 */

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
 * Search locations with fuzzy matching
 * Returns sorted results by relevance
 */
export const fuzzySearchLocations = (query, locations, limit = 8) => {
  if (!query || !locations) return [];

  const queryLower = query.toLowerCase();
  const results = [];

  for (const location of locations) {
    const nameLower = location.name.toLowerCase();

    // Exact match gets highest score
    if (nameLower === queryLower) {
      results.push({ location, score: 2 });
      continue;
    }

    // Starts with query gets boosted score
    if (nameLower.startsWith(queryLower)) {
      results.push({ location, score: 1.5 + jaroWinkler(queryLower, nameLower) });
      continue;
    }

    // Contains query gets medium boost
    if (nameLower.includes(queryLower)) {
      results.push({ location, score: 1 + jaroWinkler(queryLower, nameLower) });
      continue;
    }

    // Fuzzy match
    const score = jaroWinkler(queryLower, nameLower);
    if (score > 0.7) {
      results.push({ location, score });
    }
  }

  // Sort by score descending, then by verse count for ties
  results.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    return (b.location.verses?.length || 0) - (a.location.verses?.length || 0);
  });

  return results.slice(0, limit).map(r => r.location);
};
