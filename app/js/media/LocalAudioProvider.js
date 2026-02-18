/**
 * LocalAudioProvider
 * Loads audio from local JSON manifests at content/audio/{textId}/info.json
 */

import { BaseAudioProvider } from './BaseAudioProvider.js';
import { getConfig } from '../core/config.js';

export class LocalAudioProvider extends BaseAudioProvider {
  get name() { return 'local'; }

  async getAudioInfo(textInfo) {
    const config = getConfig();
    let checkDirectory = textInfo.id;

    if (textInfo.audioDirectory !== undefined) {
      if (textInfo.audioDirectory === '') {
        return null;
      } else {
        checkDirectory = textInfo.audioDirectory;
      }
    }

    try {
      const response = await fetch(`${config.baseContentUrl}content/audio/${checkDirectory}/info.json`);
      if (!response.ok) return null;

      const audioInfo = await response.json();
      if (audioInfo === undefined) return null;

      audioInfo.type = 'local';
      audioInfo.directory = checkDirectory;

      if (!audioInfo.title) {
        audioInfo.title = 'Local';
      }

      return audioInfo;
    } catch {
      return null;
    }
  }

  _findFragmentData(audioInfo, fragmentid) {
    const verseParts = fragmentid.split('_');
    const sectionid = verseParts[0];
    const verseNumber = parseInt(verseParts[1], 10);
    let fragmentIndex = 0;
    let fragmentData = null;

    for (const [i, fragmentFileinfo] of audioInfo.fragments.entries()) {
      const startFragmentParts = fragmentFileinfo.start.split('_');
      const startSectionid = startFragmentParts[0];

      if (sectionid === startSectionid) {
        const startVerseNumber = parseInt(startFragmentParts[1], 10);
        const endFragmentParts = fragmentFileinfo.end.split('_');
        const endVerseNumber = parseInt(endFragmentParts[1], 10);

        if (verseNumber >= startVerseNumber && verseNumber <= endVerseNumber) {
          fragmentIndex = i;
          fragmentData = fragmentFileinfo;
          break;
        }
      }
    }

    if (fragmentData != null) {
      fragmentData.index = fragmentIndex;
    }

    return fragmentData;
  }

  async getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption) {
    const config = getConfig();
    const fragmentData = this._findFragmentData(audioInfo, fragmentid);

    if (fragmentData == null) return null;

    const ext = Array.isArray(fragmentData.exts) ? fragmentData.exts[0] : fragmentData.exts;
    return {
      url: `${config.baseContentUrl}content/audio/${audioInfo.directory}/${fragmentData.filename}.${ext}`,
      id: fragmentData.index,
      start: fragmentData.start,
      end: fragmentData.end
    };
  }

  async getNextFragment(textInfo, audioInfo, fragmentid) {
    const fragmentData = this._findFragmentData(audioInfo, fragmentid);
    if (fragmentData == null) return null;

    if (fragmentData.index < audioInfo.fragments.length - 1) {
      return audioInfo.fragments[fragmentData.index + 1].start;
    }
    return null;
  }

  async getPrevFragment(textInfo, audioInfo, fragmentid) {
    const fragmentData = this._findFragmentData(audioInfo, fragmentid);
    if (fragmentData == null) return null;

    if (fragmentData.index > 0) {
      return audioInfo.fragments[fragmentData.index - 1].start;
    }
    return null;
  }
}
