/**
 * AudioDataManager
 * Unified audio API that delegates to registered audio providers.
 * Providers implement async methods (BaseAudioProvider interface).
 * This manager wraps them in the callback API that AudioController expects.
 */

import { getAudioSources } from '../core/registry.js';

/**
 * Create an audio data manager that tries each registered provider until one provides data
 * @returns {{getAudioInfo: Function, getFragmentAudio: Function, getNextFragment: Function, getPrevFragment: Function}}
 */
export function AudioDataManager() {
  const getAudioInfo = (textInfo, callback) => {
    const audioSources = getAudioSources();

    if (audioSources.length === 0) {
      callback(null);
      return;
    }

    let index = 0;

    const tryNext = async () => {
      if (index >= audioSources.length) {
        callback(null);
        return;
      }

      try {
        const audioInfo = await audioSources[index].getAudioInfo(textInfo);
        if (audioInfo != null) {
          audioInfo.audioSourceIndex = index;
          callback(audioInfo);
        } else {
          index++;
          tryNext();
        }
      } catch (err) {
        console.warn(`AudioDataManager: provider ${audioSources[index]?.name ?? index} threw for "${textInfo?.id}"`, err);
        index++;
        tryNext();
      }
    };

    tryNext();
  };

  const getFragmentAudio = (textInfo, audioInfo, fragmentid, audioOption, callback) => {
    const audioSources = getAudioSources();
    if (audioInfo?.audioSourceIndex !== undefined) {
      audioSources[audioInfo.audioSourceIndex]
        .getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption)
        .then(result => callback(result))
        .catch(err => {
          console.warn('AudioDataManager: getFragmentAudio failed', err);
          callback(null);
        });
    } else {
      callback(null);
    }
  };

  const getNextFragment = (textInfo, audioInfo, fragmentid, callback) => {
    const audioSources = getAudioSources();
    if (audioInfo?.audioSourceIndex !== undefined) {
      audioSources[audioInfo.audioSourceIndex]
        .getNextFragment(textInfo, audioInfo, fragmentid)
        .then(result => callback(result))
        .catch(err => {
          console.warn('AudioDataManager: getNextFragment failed', err);
          callback(null);
        });
    } else {
      callback(null);
    }
  };

  const getPrevFragment = (textInfo, audioInfo, fragmentid, callback) => {
    const audioSources = getAudioSources();
    if (audioInfo?.audioSourceIndex !== undefined) {
      audioSources[audioInfo.audioSourceIndex]
        .getPrevFragment(textInfo, audioInfo, fragmentid)
        .then(result => callback(result))
        .catch(err => {
          console.warn('AudioDataManager: getPrevFragment failed', err);
          callback(null);
        });
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

export default AudioDataManager;
