/**
 * AudioController
 * Controls audio playback synchronized with text scrolling
 */

import { createElements, offset, deepMerge } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';
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

  let block = createElements(
    `<div class="audio-controller">
      <audio></audio>
      <div class="audio-slider">
        <div class="audio-slider-current"></div>
        <div class="audio-slider-loaded"></div>
        <span class="audio-slider-handle"></span>
      </div>
      <input type="button" class="audio-prev" value="Prev" />
      <input type="button" class="audio-play" value="Play" />
      <input type="button" class="audio-next" value="Next" />
      <span class="audio-currenttime">00:00</span>
      <span class="audio-duration">00:00</span>
      <span class="audio-title"></span>
      <span class="audio-subtitle"></span>
      <input type="button" class="audio-options-button image-config-light" />
    </div>`
  );
  containerEl.appendChild(block);

  const optionsButton = block.querySelector('.audio-options-button');

  let options = createElements(
    `<div class="audio-options">
      <span class="close-button"></span>
      <strong class="i18n" data-i18n="[html]windows.audio.options"></strong>
      <label><input type="checkbox" class="audio-scroll" checked /><span class="i18n" data-i18n="[html]windows.audio.synctext" /></label>
      <label><input type="checkbox" class="audio-autoplay" checked /><span class="i18n" data-i18n="[html]windows.audio.autoplay" /></label>
      <div class="audio-dramatic-option">
        <label><input type="radio" name="${id}-dramatic-option" class="audio-dramatic-audio" disabled /><span class="i18n" data-i18n="[html]windows.audio.nondrama" /></label>
        <label><input type="radio" name="${id}-dramatic-option" class="audio-dramatic-drama" disabled /><span class="i18n" data-i18n="[html]windows.audio.drama" /></label>
      </div>
    </div>`
  );
  containerEl.appendChild(options);

  const scrollCheckbox = options.querySelector('.audio-scroll');
  const autoplayCheckbox = options.querySelector('.audio-autoplay');
  const optionsCloseButton = options.querySelector('.close-button');
  const optionsDramaticBox = options.querySelector('.audio-dramatic-option');
  const optionsDramaticDrama = options.querySelector('.audio-dramatic-drama');
  const optionsDramaticAudio = options.querySelector('.audio-dramatic-audio');
  const audio = block.querySelector('audio');
  const playButton = block.querySelector('.audio-play');
  const nextButton = block.querySelector('.audio-next');
  const prevButton = block.querySelector('.audio-prev');
  const currenttime = block.querySelector('.audio-currenttime');
  const duration = block.querySelector('.audio-duration');
  const title = block.querySelector('.audio-title');
  const subtitle = block.querySelector('.audio-subtitle');
  const audioSlider = block.querySelector('.audio-slider');
  const audioSliderCurrent = block.querySelector('.audio-slider-current');
  const audioSliderHandle = block.querySelector('.audio-slider-handle');
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
        audioDataManager.getAudioInfo(textInfo, (newAudioInfo) => {
          if (newAudioInfo != null) {
            audioInfo = newAudioInfo;
            hasAudio = true;
            sectionid = '';
            fragmentAudioData = null;

            if (audioInfo.type == 'local') {
              optionsDramaticBox.style.display = 'none';
            } else if (audioInfo.type == 'fcbh') {
              optionsDramaticBox.style.display = '';

              const hasNonDrama =
                (audioInfo.fcbh_audio_nt !== undefined && audioInfo.fcbh_audio_nt != '') ||
                (audioInfo.fcbh_audio_ot !== undefined && audioInfo.fcbh_audio_ot != '');
              const hasDrama =
                (audioInfo.fcbh_drama_nt !== undefined && audioInfo.fcbh_drama_nt != '') ||
                (audioInfo.fcbh_drama_ot !== undefined && audioInfo.fcbh_drama_ot != '');

              if (hasNonDrama && hasDrama) {
                optionsDramaticAudio.disabled = false;
                optionsDramaticDrama.disabled = false;
              } else {
                optionsDramaticAudio.disabled = true;
                optionsDramaticDrama.disabled = true;
              }

              if (hasNonDrama) {
                optionsDramaticAudio.checked = true;
                optionsDramaticDrama.checked = false;
              } else {
                optionsDramaticAudio.checked = false;
                optionsDramaticDrama.checked = true;
              }
            }

            if (fragmentid != '') {
              const newFragmentid = fragmentid;
              fragmentid = '';
              loadAudio(newFragmentid);
            } else {
              locationInfo = scroller.getLocationInfo();
              if (locationInfo != null) {
                loadAudio(locationInfo.fragmentid);
              }
            }

            if (toggleButtonEl) toggleButtonEl.style.display = '';

            ext.trigger('audioavailable', { type: 'audioavailable', data: { hasAudio: true } });
          } else {
            hasAudio = false;

            if (toggleButtonEl) {
              toggleButtonEl.style.display = 'none';
              block.style.display = 'none';
            }

            ext.trigger('audioavailable', { type: 'audioavailable', data: { hasAudio: false } });
          }
        });
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
  ext = deepMerge(ext, EventEmitterMixin);

  return ext;
}

export default AudioController;
