/**
 * AudioDataManager
 * Manages audio data sources and provides unified audio API
 */

import { getConfig } from '../core/config.js';
import { getAudioSources, registerAudioSource } from '../core/registry.js';

export function AudioDataManager() {
  const getAudioInfo = (textInfo, callback) => {
    const audioSources = getAudioSources();
    let index = 0;

    const doNext = () => {
      if (index >= audioSources.length) {
        callback(null);
        return;
      }

      const audioSource = audioSources[index];
      audioSource.getAudioInfo(textInfo, receiveData);
    };

    const receiveData = (audioInfo) => {
      if (audioInfo != null) {
        audioInfo.audioSourceIndex = index;
        callback(audioInfo);
      } else {
        index++;
        if (index < audioSources.length) {
          doNext();
        } else {
          callback(null);
        }
      }
    };

    if (audioSources.length === 0) {
      callback(null);
      return;
    }

    doNext();
  };

  const getFragmentAudio = (textInfo, audioInfo, fragmentid, audioOption, callback) => {
    const audioSources = getAudioSources();
    if (audioInfo?.audioSourceIndex !== undefined) {
      audioSources[audioInfo.audioSourceIndex].getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption, callback);
    } else {
      callback(null);
    }
  };

  const getNextFragment = (textInfo, audioInfo, fragmentid, callback) => {
    const audioSources = getAudioSources();
    if (audioInfo?.audioSourceIndex !== undefined) {
      audioSources[audioInfo.audioSourceIndex].getNextFragment(textInfo, audioInfo, fragmentid, callback);
    } else {
      callback(null);
    }
  };

  const getPrevFragment = (textInfo, audioInfo, fragmentid, callback) => {
    const audioSources = getAudioSources();
    if (audioInfo?.audioSourceIndex !== undefined) {
      audioSources[audioInfo.audioSourceIndex].getPrevFragment(textInfo, audioInfo, fragmentid, callback);
    } else {
      callback(null);
    }
  };

  return {
    getAudioInfo,
    getFragmentAudio,
    getNextFragment,
    getPrevFragment
  };
}

export const LocalAudio = (() => {
  const getAudioInfo = (textInfo, callback) => {
    const config = getConfig();
    let checkDirectory = textInfo.id;

    if (textInfo.audioDirectory !== undefined) {
      if (textInfo.audioDirectory === '') {
        callback(null);
        return;
      } else {
        checkDirectory = textInfo.audioDirectory;
      }
    }

    fetch(`${config.baseContentUrl}content/audio/${checkDirectory}/info.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((audioInfo) => {
        if (audioInfo === undefined) {
          callback(null);
          return;
        }

        audioInfo.type = 'local';
        audioInfo.directory = checkDirectory;

        if (!audioInfo.title) {
          audioInfo.title = 'Local';
        }

        callback(audioInfo);
      })
      .catch(() => {
        callback(null);
      });
  };

  const findFragmentData = (audioInfo, fragmentid) => {
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
  };

  const getFragmentAudio = (textInfo, audioInfo, fragmentid, audioOption, callback) => {
    const config = getConfig();
    const fragmentData = findFragmentData(audioInfo, fragmentid);

    if (fragmentData == null) {
      callback(null);
      return;
    }

    const ext = Array.isArray(fragmentData.exts) ? fragmentData.exts[0] : fragmentData.exts;
    const audioData = {
      url: `${config.baseContentUrl}content/audio/${audioInfo.directory}/${fragmentData.filename}.${ext}`,
      id: fragmentData.index,
      start: fragmentData.start,
      end: fragmentData.end
    };

    callback(audioData);
  };

  const getNextFragment = (textInfo, audioInfo, fragmentid, callback) => {
    const fragmentData = findFragmentData(audioInfo, fragmentid);

    if (fragmentData == null) {
      callback(null);
      return;
    }

    if (fragmentData.index < audioInfo.fragments.length - 1) {
      const nextFragmentData = audioInfo.fragments[fragmentData.index + 1];
      callback(nextFragmentData.start);
    } else {
      callback(null);
    }
  };

  const getPrevFragment = (textInfo, audioInfo, fragmentid, callback) => {
    const fragmentData = findFragmentData(audioInfo, fragmentid);

    if (fragmentData == null) {
      callback(null);
      return;
    }

    if (fragmentData.index > 0) {
      const prevFragmentData = audioInfo.fragments[fragmentData.index - 1];
      callback(prevFragmentData.start);
    } else {
      callback(null);
    }
  };

  return {
    getAudioInfo,
    getFragmentAudio,
    getNextFragment,
    getPrevFragment
  };
})();

registerAudioSource(LocalAudio);

export default AudioDataManager;
