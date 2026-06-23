/**
 * Whether a version can display the given reference.
 * Mirrors the book+chapter fallback in TextLoader.loadSection so padding
 * differences (e.g. "GN1" vs "GN01") don't read as a missing section. With no
 * section list, or no reference to check, the version is assumed capable.
 * @param {Object} textInfo - Full text info (expects a `sections` array)
 * @param {string} [sectionid] - Section id of the current reference (e.g. "JN1")
 * @returns {boolean}
 */
export function versionHasSection(textInfo, sectionid) {
  if (!sectionid) return true;

  const sections = textInfo?.sections;
  if (!Array.isArray(sections) || sections.length === 0) return true;
  if (sections.includes(sectionid)) return true;

  const bookPrefix = sectionid.substring(0, 2);
  const chapterNum = parseInt(sectionid.substring(2), 10);
  return sections.some((s) => s.startsWith(bookPrefix) && parseInt(s.substring(2), 10) === chapterNum);
}

/**
 * Indices to probe when cycling, ordered outward from `startIndex` in
 * `direction` (-1/+1) and wrapping around. Excludes `startIndex` itself, so the
 * result has `len - 1` entries.
 * @param {number} len - Number of versions
 * @param {number} startIndex - Index of the current version
 * @param {number} direction - -1 (previous) or +1 (next)
 * @returns {number[]} Candidate indices in probe order
 */
export function probeOrder(len, startIndex, direction) {
  const order = [];
  for (let offset = 1; offset <= len - 1; offset++) {
    order.push((((startIndex + direction * offset) % len) + len) % len);
  }
  return order;
}
