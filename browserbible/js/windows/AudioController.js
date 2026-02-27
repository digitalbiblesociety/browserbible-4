/**
 * AudioController
 * Controls audio playback synchronized with text scrolling
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { i18n } from '../lib/i18n.js';
import { Reference } from '../bible/BibleReference.js';
import { AudioDataManager } from '../media/AudioDataManager.js';
import playSvg from '../../css/images/audio/play-icon.svg?raw';
import pauseSvg from '../../css/images/audio/pause-icon.svg?raw';
import prevSvg from '../../css/images/audio/previous-icon.svg?raw';
import nextSvg from '../../css/images/audio/next-icon.svg?raw';
import gearSvg from '../../css/images/gear.svg?raw';

/**
 * Create an audio controller for text windows
 * @param {string} id - Window ID
 * @param {HTMLElement} container - Container element
 * @param {HTMLElement} toggleButton - Button to toggle audio visibility
 * @param {Object} scroller - Scroller instance
 * @returns {Object} AudioController API
 */
export function AudioController(id, container, toggleButton, scroller) {
  const containerEl = container?.nodeType ? container : container?.[0];

  const audio = elem('audio');
  const audioSliderCurrent = elem('div', { className: 'audio-slider-current' });
  const audioSliderLoaded = elem('div', { className: 'audio-slider-loaded' });
  const audioSliderHandle = elem('span', { className: 'audio-slider-handle' });
  const audioSlider = elem('div', { className: 'audio-slider' }, audioSliderCurrent, audioSliderLoaded, audioSliderHandle);
  const prevButton = elem('div', { className: 'audio-prev' });
  prevButton.innerHTML = prevSvg;
  const playButton = elem('div', { className: 'audio-play' });
  playButton.innerHTML = playSvg;
  const nextButton = elem('div', { className: 'audio-next' });
  nextButton.innerHTML = nextSvg;
  const currenttime = elem('span', { className: 'audio-currenttime' }, '00:00');
  const duration = elem('span', { className: 'audio-duration' }, '00:00');
  const title = elem('span', { className: 'audio-title' });
  const subtitle = elem('span', { className: 'audio-subtitle' });
  const optionsButton = elem('div', { className: 'audio-options-button' });
  optionsButton.innerHTML = gearSvg;
  let block = elem('div', { className: 'audio-controller' }, audio, audioSlider, prevButton, playButton, nextButton, currenttime, duration, title, subtitle, optionsButton);
  containerEl.appendChild(block);

  const optionsCloseButton = elem('span', { className: 'close-button' });
  const optionsTitle = elem('strong', { className: 'i18n', dataset: { i18n: '[html]windows.audio.options' } });
  const scrollCheckbox = elem('input', { type: 'checkbox', className: 'audio-scroll', checked: true });
  const scrollLabel = elem('label', {}, scrollCheckbox, elem('span', { className: 'i18n', dataset: { i18n: '[html]windows.audio.synctext' } }));
  const autoplayCheckbox = elem('input', { type: 'checkbox', className: 'audio-autoplay', checked: true });
  const autoplayLabel = elem('label', {}, autoplayCheckbox, elem('span', { className: 'i18n', dataset: { i18n: '[html]windows.audio.autoplay' } }));
  const optionsDramaticAudio = elem('input', { type: 'radio', name: `${id}-dramatic-option`, className: 'audio-dramatic-audio', disabled: true });
  const audioLabel = elem('label', {}, optionsDramaticAudio, elem('span', { className: 'i18n', dataset: { i18n: '[html]windows.audio.nondrama' } }));
  const optionsDramaticDrama = elem('input', { type: 'radio', name: `${id}-dramatic-option`, className: 'audio-dramatic-drama', disabled: true });
  const dramaLabel = elem('label', {}, optionsDramaticDrama, elem('span', { className: 'i18n', dataset: { i18n: '[html]windows.audio.drama' } }));
  const optionsDramaticBox = elem('div', { className: 'audio-dramatic-option' }, audioLabel, dramaLabel);
  let options = elem('div', { className: 'audio-options' }, optionsCloseButton, optionsTitle, scrollLabel, autoplayLabel, optionsDramaticBox);
  containerEl.appendChild(options);
  const audioDataManager = new AudioDataManager();

  let isDraggingSliderHandle = false;
  let textInfo = null;
  let audioInfo = null;
  let locationInfo = null;
  let sectionid = '';
  let fragmentid = '';
  let fragmentAudioData = null;
  let loadAudioWhenPlayIsPressed = false;
  let sectionHeight = 0;
  let sectionNode = null;
  let hasAudio = false;
  let lastTimestampVerse = 0;

  scrollCheckbox.checked = true;
  autoplayCheckbox.checked = true;

  i18n.translatePage(options);

  const toggleButtonEl = toggleButton?.nodeType ? toggleButton : toggleButton?.[0];

  if (toggleButtonEl != null) {
    toggleButtonEl.style.display = 'none';
    block.style.display = 'none';
  }
  options.style.display = 'none';

  const docClick = (e) => {
    let target = e.target;
    let clickedOnOptions = false;

    while (target != null) {
      if (target == options) {
        clickedOnOptions = true;
        break;
      }
      target = target.parentNode;
    }

    if (!clickedOnOptions) {
      e.preventDefault();
      options.style.display = 'none';
      document.removeEventListener('click', docClick);
      return false;
    }
  };

  optionsButton.addEventListener('click', () => {
    if (options.style.display !== 'none') {
      options.style.display = 'none';
      document.removeEventListener('click', docClick);
    } else {
      options.style.display = '';
      setTimeout(() => {
        document.addEventListener('click', docClick);
      });
    }
  }, false);

  optionsCloseButton.addEventListener('click', () => {
    options.style.display = 'none';
    document.removeEventListener('click', docClick);
  }, false);

  const updateDramatic = () => {
    const storedFragmentid = fragmentid;

    fragmentid = '';
    sectionid = '';
    fragmentAudioData = null;
    loadAudioWhenPlayIsPressed = false;

    if (!audio.paused && !audio.ended) {
      audio.pause();
      audio.src = '';
    }

    audio.addEventListener('loadeddata', playWhenLoaded);
    loadAudio(storedFragmentid);
  };

  optionsDramaticAudio.addEventListener('change', updateDramatic, false);
  optionsDramaticDrama.addEventListener('change', updateDramatic, false);

  if (toggleButtonEl != null) {
    toggleButtonEl.addEventListener('click', () => {
      if (block.style.display !== 'none') {
        block.style.display = 'none';
      } else {
        block.style.display = '';
      }
    }, false);
  }

  playButton.addEventListener('click', () => {
    if (!audio.getAttribute('src')) {
      if (loadAudioWhenPlayIsPressed) {
        audio.src = fragmentAudioData.url;
        audio.load();
        audio.addEventListener('loadeddata', playWhenLoaded);
        loadAudioWhenPlayIsPressed = false;
      }
      return;
    }

    if (audio.paused || audio.ended) {
      audio.play();
    } else {
      audio.pause();
    }
  }, false);

  const skipToFragment = (getFragment) => {
    getFragment(textInfo, audioInfo, fragmentid, (newFragmentid) => {
      if (newFragmentid == null) return;

      if (scrollCheckbox.checked) {
        if (scroller?.load) {
          scroller.load('text', newFragmentid.split('_')[0], newFragmentid);
        }
      }

      if (fragmentAudioData == null || newFragmentid != fragmentAudioData.fragmentid) {
        loadAudio(newFragmentid);
        audio.addEventListener('loadeddata', playWhenLoaded);
      }
    });
  };

  prevButton.addEventListener('click', () => skipToFragment(audioDataManager.getPrevFragment.bind(audioDataManager)), false);
  nextButton.addEventListener('click', () => skipToFragment(audioDataManager.getNextFragment.bind(audioDataManager)), false);

  if (scroller != null) {
    const updateLocation = (e) => {
      const newLocationInfo = e.data;
      if (newLocationInfo != null) {
        locationInfo = newLocationInfo;
        loadAudio(locationInfo.fragmentid);
      }
    };
    scroller.on('locationchange', updateLocation);
  }

  const loadAudio = (newFragmentid) => {
    if (!hasAudio) return;
    if (typeof newFragmentid === 'undefined') return;

    if (fragmentid != newFragmentid) {
      fragmentid = newFragmentid;

      const newSectionid = fragmentid.split('_')[0];
      const loadNewData = audioInfo.pericopeBased || newSectionid != sectionid;

      sectionid = newSectionid;

      if (loadNewData) {
        let audioOption = '';
        if (optionsDramaticDrama.checked) {
          audioOption = 'drama';
        } else if (optionsDramaticAudio.checked) {
          audioOption = 'audio';
        }

        audioDataManager.getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption, (newFragmentAudioData) => {
          if (fragmentAudioData == null || newFragmentAudioData == null || fragmentAudioData.id != newFragmentAudioData.id) {
            if (!newFragmentAudioData || newFragmentAudioData.url == null) {
              audio.removeAttribute('src');
              title.innerHTML = '[No audio]';

              if (toggleButtonEl) {
                toggleButtonEl.style.display = 'none';
                block.style.display = 'none';
              }

              fragmentAudioData = newFragmentAudioData;
              return;
            } else {
              if (toggleButtonEl) toggleButtonEl.style.display = '';
              fragmentAudioData = newFragmentAudioData;
              lastTimestampVerse = 0;
            }

            if (block.style.display !== 'none') {
              audio.src = fragmentAudioData.url;
              audio.load();
            } else {
              loadAudioWhenPlayIsPressed = true;
            }

            sectionNode = containerEl.querySelector(`.section[data-id="${sectionid}"]`);
            sectionHeight = sectionNode?.offsetHeight ?? 0;

            title.innerHTML = Reference(sectionid)?.toString() ?? sectionid;
            subtitle.innerHTML = audioInfo.title;
          }
        });
      }
    }
  };

  const playWhenLoaded = () => {
    audio.play();
    audio.removeEventListener('loadeddata', playWhenLoaded);
  };

  const handlePlayPlaying = () => {
    const thisAudio = audio;

    playButton.innerHTML = pauseSvg;
    playButton.classList.add('playing');

    // Pause all other audio/video elements when this one starts playing
    document.querySelectorAll('audio,video').forEach((audioOrVideoNode) => {
      if (audioOrVideoNode != thisAudio && !audioOrVideoNode.paused && !audioOrVideoNode.ended) {
        audioOrVideoNode.pause();
      }
    });
  };

  audio.addEventListener('play', handlePlayPlaying, false);
  audio.addEventListener('playing', handlePlayPlaying, false);

  const handlePauseEnded = () => {
    playButton.innerHTML = playSvg;
    playButton.classList.remove('playing');
  };

  audio.addEventListener('pause', handlePauseEnded, false);
  audio.addEventListener('ended', handlePauseEnded, false);

  audio.addEventListener('loadstart', () => {
    playButton.innerHTML = playSvg;
    playButton.classList.remove('playing');

    audioSliderHandle.style.left = '0%';
    currenttime.innerHTML = secondsToTimeCode(0);
    duration.innerHTML = secondsToTimeCode(0);
  }, false);

  audio.addEventListener('loadedmetadata', () => {
    duration.innerHTML = secondsToTimeCode(audio.duration);
  }, false);

  audio.addEventListener('ended', () => {
    if (autoplayCheckbox.checked) {
      audio.addEventListener('loadeddata', playWhenLoaded);
      nextButton.click();
    }
  }, false);

  audio.addEventListener('timeupdate', () => {
    currenttime.innerHTML = secondsToTimeCode(audio.currentTime);
    duration.innerHTML = secondsToTimeCode(audio.duration);

    audioSliderCurrent.style.width = `${audio.currentTime / audio.duration * 100}%`;
    if (!isDraggingSliderHandle) {
      audioSliderHandle.style.left = `${audio.currentTime / audio.duration * 100}%`;
    }

    if (!scrollCheckbox.checked || toggleButtonEl == null) return;

    if (!sectionNode) {
      sectionNode = containerEl.querySelector(`.section[data-id="${sectionid}"]`);
    }
    if (!sectionNode) return;

    const pane = containerEl.querySelector('.scroller-main');
    if (!pane) return;

    // Verse-level sync when timestamps are available
    if (fragmentAudioData?.timestamps) {
      let currentVerse = 1;
      for (const ts of fragmentAudioData.timestamps) {
        if (audio.currentTime >= ts.time) {
          currentVerse = ts.verse;
        } else {
          break;
        }
      }

      if (currentVerse !== lastTimestampVerse) {
        lastTimestampVerse = currentVerse;

        const verses = sectionNode.querySelectorAll('.v');
        const verseEl = (currentVerse > 0 && currentVerse <= verses.length)
          ? verses[currentVerse - 1]
          : null;

        if (verseEl) {
          const paneTop = offset(pane).top;
          const scrollTop = pane.scrollTop;
          const verseTop = offset(verseEl).top;
          const verseTopAdjusted = verseTop - paneTop + scrollTop;

          scroller.setFocus(true);
          pane.scrollTop = verseTopAdjusted;
        }
      }
      return;
    }

    // Proportional estimation fallback
    sectionHeight = sectionNode.offsetHeight;

    const chapter = parseInt(sectionid.substring(2), 10);
    const skipSeconds = (chapter == 1) ? 10 : 8;
    const fraction = (audio.currentTime - skipSeconds) / (audio.duration - skipSeconds);

    const paneTop = offset(pane).top;
    const scrollTop = pane.scrollTop;
    const nodeTop = offset(sectionNode).top;
    const nodeTopAdjusted = nodeTop - paneTop + scrollTop;

    const firstVerse = sectionNode.querySelector('.v');
    const lastVerse = sectionNode.querySelector('.v:last-child');
    let scrollOffset = sectionHeight * fraction
      - (firstVerse?.offsetHeight ?? 0)
      - ((lastVerse?.offsetHeight ?? 0) * fraction);

    if (scrollOffset <= 0) scrollOffset = 0;

    scroller.setFocus(true);
    pane.scrollTop = nodeTopAdjusted + scrollOffset;
  }, false);

  const documentMouseUp = (e) => {
    isDraggingSliderHandle = false;
    document.removeEventListener('mousemove', documentMouseMove);
    document.removeEventListener('mouseup', documentMouseUp);
  };

  const documentMouseMove = (e) => {
    const width = audioSlider.offsetWidth;
    const pos = offset(audioSlider);
    const clientX = e.clientX;
    const offsetX = clientX - pos.left;
    const percent = offsetX / width;
    const newTime = percent * audio.duration;

    audioSliderHandle.style.left = `${percent * 100}%`;
    audio.currentTime = newTime;
  };

  audioSliderHandle.addEventListener('mousedown', (e) => {
    isDraggingSliderHandle = true;
    document.addEventListener('mousemove', documentMouseMove);
    document.addEventListener('mouseup', documentMouseUp);
  }, false);

  audioSlider.addEventListener('click', (e) => {
    const width = audioSlider.offsetWidth;
    const offsetX = e.offsetX;
    const percent = offsetX / width;
    const newTime = percent * audio.duration;

    audio.currentTime = newTime;
  }, false);

  const configureFcbhDramaOptions = (info) => {
    optionsDramaticBox.style.display = '';

    const hasNonDrama =
      (info.fcbh_audio_nt !== undefined && info.fcbh_audio_nt != '') ||
      (info.fcbh_audio_ot !== undefined && info.fcbh_audio_ot != '');
    const hasDrama =
      (info.fcbh_drama_nt !== undefined && info.fcbh_drama_nt != '') ||
      (info.fcbh_drama_ot !== undefined && info.fcbh_drama_ot != '');

    const hasBoth = hasNonDrama && hasDrama;
    optionsDramaticAudio.disabled = !hasBoth;
    optionsDramaticDrama.disabled = !hasBoth;
    optionsDramaticAudio.checked = hasNonDrama;
    optionsDramaticDrama.checked = !hasNonDrama;
  };

  const initializeAudioPlayback = () => {
    if (fragmentid != '') {
      const newFragmentid = fragmentid;
      fragmentid = '';
      loadAudio(newFragmentid);
      return;
    }
    locationInfo = scroller.getLocationInfo();
    if (locationInfo != null) {
      loadAudio(locationInfo.fragmentid);
    }
  };

  const handleAudioInfoResult = (newAudioInfo) => {
    if (newAudioInfo == null) {
      hasAudio = false;
      if (toggleButtonEl) {
        toggleButtonEl.style.display = 'none';
        block.style.display = 'none';
      }
      ext.trigger('audioavailable', { type: 'audioavailable', data: { hasAudio: false } });
      return;
    }

    audioInfo = newAudioInfo;
    hasAudio = true;
    sectionid = '';
    fragmentAudioData = null;

    if (audioInfo.type == 'local' || audioInfo.type == 'dbs') {
      optionsDramaticBox.style.display = 'none';
    } else if (audioInfo.type == 'fcbh') {
      configureFcbhDramaOptions(audioInfo);
    }

    initializeAudioPlayback();

    if (toggleButtonEl) toggleButtonEl.style.display = '';
    ext.trigger('audioavailable', { type: 'audioavailable', data: { hasAudio: true } });
  };

  const setTextInfo = (newTextInfo) => {
    if (textInfo == null || textInfo.id != newTextInfo.id) {
      title.innerHTML = '';
      subtitle.innerHTML = '';
      audioSliderCurrent.style.left = '0%';
      audioSliderHandle.style.left = '0%';
      currenttime.innerHTML = secondsToTimeCode(0);
      duration.innerHTML = secondsToTimeCode(0);

      textInfo = newTextInfo;

      if (!audio.paused && !audio.ended) {
        try {
          audio.pause();
        } catch (e) {
          // ignore
        }
      }
      audio.removeAttribute('src');
      audio.load();

      if (textInfo.type == 'bible') {
        audioDataManager.getAudioInfo(textInfo, handleAudioInfoResult);
      }
    }
  };

  const secondsToTimeCode = (time) => {
    const minutes = Math.floor(time / 60) % 60;
    const seconds = Math.floor(time % 60);
    return `${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  const size = (width, height) => {
    block.style.width = `${width}px`;
  };

  const close = () => {
    ext.clearListeners();

    if (block?.parentNode) {
      block.parentNode.removeChild(block);
    }
    if (options?.parentNode) {
      options.parentNode.removeChild(options);
    }

    block = null;
    options = null;
  };

  let ext = {
    setTextInfo,
    size,
    close
  };
  mixinEventEmitter(ext);

  return ext;
}

export default AudioController;
