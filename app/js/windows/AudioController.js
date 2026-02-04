/**
 * AudioController
 * Controls audio playback synchronized with text scrolling
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { i18n } from '../lib/i18n.js';
import { Reference } from '../bible/BibleReference.js';
import { AudioDataManager } from '../media/AudioDataManager.js';

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

  let block = elem('div', { className: 'audio-controller' });
  const audio = elem('audio');
  const audioSlider = elem('div', { className: 'audio-slider' });
  const audioSliderCurrent = elem('div', { className: 'audio-slider-current' });
  const audioSliderLoaded = elem('div', { className: 'audio-slider-loaded' });
  const audioSliderHandle = elem('span', { className: 'audio-slider-handle' });
  audioSlider.append(audioSliderCurrent, audioSliderLoaded, audioSliderHandle);
  const prevButton = elem('input', { type: 'button', className: 'audio-prev', value: 'Prev' });
  const playButton = elem('input', { type: 'button', className: 'audio-play', value: 'Play' });
  const nextButton = elem('input', { type: 'button', className: 'audio-next', value: 'Next' });
  const currenttime = elem('span', { className: 'audio-currenttime', textContent: '00:00' });
  const duration = elem('span', { className: 'audio-duration', textContent: '00:00' });
  const title = elem('span', { className: 'audio-title' });
  const subtitle = elem('span', { className: 'audio-subtitle' });
  const optionsButton = elem('input', { type: 'button', className: 'audio-options-button image-config-light' });
  block.append(audio, audioSlider, prevButton, playButton, nextButton, currenttime, duration, title, subtitle, optionsButton);
  containerEl.appendChild(block);

  let options = elem('div', { className: 'audio-options' });
  const optionsCloseButton = elem('span', { className: 'close-button' });
  const optionsTitle = elem('strong', { className: 'i18n' });
  optionsTitle.setAttribute('data-i18n', '[html]windows.audio.options');
  const scrollLabel = elem('label');
  const scrollCheckbox = elem('input', { type: 'checkbox', className: 'audio-scroll', checked: true });
  const scrollSpan = elem('span', { className: 'i18n' });
  scrollSpan.setAttribute('data-i18n', '[html]windows.audio.synctext');
  scrollLabel.append(scrollCheckbox, scrollSpan);
  const autoplayLabel = elem('label');
  const autoplayCheckbox = elem('input', { type: 'checkbox', className: 'audio-autoplay', checked: true });
  const autoplaySpan = elem('span', { className: 'i18n' });
  autoplaySpan.setAttribute('data-i18n', '[html]windows.audio.autoplay');
  autoplayLabel.append(autoplayCheckbox, autoplaySpan);
  const optionsDramaticBox = elem('div', { className: 'audio-dramatic-option' });
  const audioLabel = elem('label');
  const optionsDramaticAudio = elem('input', { type: 'radio', name: `${id}-dramatic-option`, className: 'audio-dramatic-audio', disabled: true });
  const audioSpan = elem('span', { className: 'i18n' });
  audioSpan.setAttribute('data-i18n', '[html]windows.audio.nondrama');
  audioLabel.append(optionsDramaticAudio, audioSpan);
  const dramaLabel = elem('label');
  const optionsDramaticDrama = elem('input', { type: 'radio', name: `${id}-dramatic-option`, className: 'audio-dramatic-drama', disabled: true });
  const dramaSpan = elem('span', { className: 'i18n' });
  dramaSpan.setAttribute('data-i18n', '[html]windows.audio.drama');
  dramaLabel.append(optionsDramaticDrama, dramaSpan);
  optionsDramaticBox.append(audioLabel, dramaLabel);
  options.append(optionsCloseButton, optionsTitle, scrollLabel, autoplayLabel, optionsDramaticBox);
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
    if (audio.src == '' || audio.src == null) {
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

  prevButton.addEventListener('click', () => {
    audioDataManager.getPrevFragment(textInfo, audioInfo, fragmentid, (prevFragmentid) => {
      if (prevFragmentid == null) return;

      if (scrollCheckbox.checked) {
        if (scroller?.load) {
          scroller.load('text', prevFragmentid.split('_')[0], prevFragmentid);
        }
      }

      if (fragmentAudioData == null || prevFragmentid != fragmentAudioData.fragmentid) {
        loadAudio(prevFragmentid);
        audio.addEventListener('loadeddata', playWhenLoaded);
      }
    });
  }, false);

  nextButton.addEventListener('click', () => {
    audioDataManager.getNextFragment(textInfo, audioInfo, fragmentid, (nextFragmentid) => {
      if (nextFragmentid == null) return;

      if (scrollCheckbox.checked) {
        if (scroller?.load) {
          scroller.load('text', nextFragmentid.split('_')[0], nextFragmentid);
        }
      }

      if (fragmentAudioData == null || nextFragmentid != fragmentAudioData.fragmentid) {
        loadAudio(nextFragmentid);
        audio.addEventListener('loadeddata', playWhenLoaded);
      }
    });
  }, false);

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
              audio.src = null;
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

    playButton.setAttribute('value', 'Pause');
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
    playButton.setAttribute('value', 'Play');
    playButton.classList.remove('playing');
  };

  audio.addEventListener('pause', handlePauseEnded, false);
  audio.addEventListener('ended', handlePauseEnded, false);

  audio.addEventListener('loadstart', () => {
    playButton.setAttribute('value', 'Play');
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

    sectionHeight = sectionNode.offsetHeight;

    // Skip intro music - chapter 1 has longer intro
    const chapter = parseInt(sectionid.substring(2), 10);
    const skipSeconds = (chapter == 1) ? 10 : 8;
    const fraction = (audio.currentTime - skipSeconds) / (audio.duration - skipSeconds);

    const pane = containerEl.querySelector('.scroller-main');
    if (!pane) return;

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

    if (audioInfo.type == 'local') {
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
          audio.src = null;
        } catch (e) {
          // ignore
        }
      }

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
