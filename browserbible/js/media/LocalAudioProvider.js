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
    if (!config.localAudioEnabled) return null;

    let checkDirectory = textInfo.id;

    if (textInfo.audioDirectory !== undefined) {
      if (textInfo.audioDirectory === '') {
        return null;
      }
      checkDirectory = textInfo.audioDirectory;
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

  _findFragmentData(audio_info, section_id) {
    const [book_id, verse] = section_id.split('_');
    const verse_number = parseInt(verse, 10);

    const index = audio_info.fragments.findIndex(({ start, end }) => {
      const [current_book_id, verse_start] = start.split('_');
      return book_id === current_book_id
        && verse_number >= parseInt(verse_start, 10)
        && verse_number <= parseInt(end.split('_')[1], 10);
    });

    return index === -1 ? null : { ...audio_info.fragments[index], index };
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
