/**
 * Not a real text source: flags existing texts that have re-associated Bible
 * Brain audio (js/data/biblebrainDuplicates.js) so the picker shows an audio
 * badge; playback lives in LinkedBibleBrainAudioProvider. Runs last, once the
 * existing entries are loaded, and adds no entries of its own.
 */

import { getConfig } from '../core/config.js';
import { getTextInfoData } from './TextLoader.js';
import { hasLinkedAudio } from '../data/biblebrainDuplicates.js';

const providerName = 'biblebrain-linked-audio';

function getTextManifest(callback) {
  const config = getConfig();

  // The audio needs the Bible Brain proxy, so only badge when it's configured.
  if (!config.enableOnlineSources || !config.bibleBrainEnabled || !config.bibleBrainProxyBase) {
    callback(null);
    return;
  }

  for (const entry of getTextInfoData() || []) {
    if (!entry.hasAudio && hasLinkedAudio(entry)) {
      entry.hasAudio = true;
    }
  }

  callback(null);
}

export const BibleBrainLinkedAudioTextProvider = {
  name: providerName,
  getTextManifest,
  getTextInfo: (textid, callback) => callback(null),
  loadSection: (textid, sectionid, callback) => callback(null)
};
