/**
 * Bible Brain texts that duplicate a text DBS/inscript already serves.
 * `biblebrain-duplicates.json` comes from the proxy repo's
 * tools/find-bible-brain-duplicates.mjs (see that repo's tools/README).
 *
 *   bibleBrainExcludeIds  duplicate BB abbrs, dropped from the picker.
 *   audioAssociations     the ones with audio, kept and re-attached to the
 *                         existing text — see LinkedBibleBrainAudioProvider.
 */

import manifest from './biblebrain-duplicates.json';

export const bibleBrainExcludeIds = manifest.bibleBrainExcludeIds ?? [];

// Index by both inscript id and BB id (equal for exact matches).
const audioByCode = new Map();
for (const assoc of manifest.audioAssociations ?? []) {
  if (assoc.inscriptId) audioByCode.set(assoc.inscriptId.toUpperCase(), assoc);
  if (assoc.bibleBrainId) audioByCode.set(assoc.bibleBrainId.toUpperCase(), assoc);
}

/** Bible Brain audio association for a text bible (by id/abbr), or null. */
export function linkedAudioFor(textInfo) {
  if (!textInfo) return null;
  return audioByCode.get(String(textInfo.id ?? '').toUpperCase())
    ?? audioByCode.get(String(textInfo.abbr ?? '').toUpperCase())
    ?? null;
}

export const hasLinkedAudio = (textInfo) => linkedAudioFor(textInfo) != null;
