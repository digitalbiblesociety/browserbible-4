// Controls audio playback synchronized with text scrolling

import { elem, offset, secondsToTimeCode } from '../lib/helpers.esm.js';
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
  let audioRequestId = 0;

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
      options.style.display = 'none';
      document.removeEventListener('click', docClick);
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
  });

  optionsCloseButton.addEventListener('click', () => {
    options.style.display = 'none';
    document.removeEventListener('click', docClick);
  });

  const updateDramatic = () => {
    const storedFragmentid = fragmentid;

    fragmentid = '';
    sectionid = '';
    fragmentAudioData = null;
    loadAudioWhenPlayIsPressed = false;

    if (!audio.paused && !audio.ended) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    audio.addEventListener('loadeddata', playWhenLoaded);
    loadAudio(storedFragmentid);
  };

  optionsDramaticAudio.addEventListener('change', updateDramatic);
  optionsDramaticDrama.addEventListener('change', updateDramatic);

  if (toggleButtonEl != null) {
    toggleButtonEl.addEventListener('click', () => {
      if (block.style.display !== 'none') {
        block.style.display = 'none';
      } else {
        block.style.display = '';
      }
    });
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
      audio.play().catch(() => {
        playButton.innerHTML = playSvg;
        playButton.classList.remove('playing');
      });
    } else {
      audio.pause();
    }
  });

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

  prevButton.addEventListener('click', () => skipToFragment(audioDataManager.getPrevFragment.bind(audioDataManager)));
  nextButton.addEventListener('click', () => skipToFragment(audioDataManager.getNextFragment.bind(audioDataManager)));

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

        const requestId = ++audioRequestId;
        audioDataManager.getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption, (newFragmentAudioData) => {
          // Drop responses superseded by close() or a newer request.
          if (block == null || requestId !== audioRequestId) return;

          if (fragmentAudioData == null || newFragmentAudioData == null || fragmentAudioData.id != newFragmentAudioData.id) {
            // New chapter (or no audio): drop the previous chapter's verse highlight.
            setReadingVerse(null);
            if (!newFragmentAudioData || newFragmentAudioData.url == null) {
              audio.removeEventListener('loadeddata', playWhenLoaded);
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
    audio.play().catch(() => {
      playButton.innerHTML = playSvg;
      playButton.classList.remove('playing');
    });
    audio.removeEventListener('loadeddata', playWhenLoaded);
  };

  const handlePlayPlaying = () => {
    playButton.innerHTML = pauseSvg;
    playButton.classList.add('playing');

    // Pause all other audio/video elements when this one starts playing
    document.querySelectorAll('audio,video').forEach((audioOrVideoNode) => {
      if (audioOrVideoNode != audio && !audioOrVideoNode.paused && !audioOrVideoNode.ended) {
        audioOrVideoNode.pause();
      }
    });
  };

  audio.addEventListener('play', handlePlayPlaying);
  audio.addEventListener('playing', handlePlayPlaying);

  const handlePauseEnded = () => {
    playButton.innerHTML = playSvg;
    playButton.classList.remove('playing');
  };

  audio.addEventListener('pause', handlePauseEnded);
  audio.addEventListener('ended', handlePauseEnded);

  audio.addEventListener('loadstart', () => {
    playButton.innerHTML = playSvg;
    playButton.classList.remove('playing');

    audioSliderHandle.style.left = '0%';
    currenttime.innerHTML = secondsToTimeCode(0);
    duration.innerHTML = secondsToTimeCode(0);
  });

  audio.addEventListener('loadedmetadata', () => {
    duration.innerHTML = secondsToTimeCode(audio.duration);
  });

  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;

    audio.removeEventListener('loadeddata', playWhenLoaded);
    playButton.innerHTML = playSvg;
    playButton.classList.remove('playing');
    title.innerHTML = '[Audio unavailable]';

    audio.removeAttribute('src');
    if (fragmentAudioData?.url != null) {
      loadAudioWhenPlayIsPressed = true;
    }
  });

  audio.addEventListener('ended', () => {
    if (autoplayCheckbox.checked) {
      audio.addEventListener('loadeddata', playWhenLoaded);
      nextButton.click();
    } else {
      // Not auto-advancing: clear the highlight and reset for replay.
      setReadingVerse(null);
      lastTimestampVerse = 0;
    }
  });

  // Highlight the verse being read (scoped to this window), clearing any prior one.
  const setReadingVerse = (verseEl) => {
    containerEl.querySelectorAll('.v.audio-reading').forEach(el => el.classList.remove('audio-reading'));
    if (verseEl) verseEl.classList.add('audio-reading');
  };

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

        // Match by fragment id, not DOM position — verse numbers can have gaps.
        const verseEl = sectionNode.querySelector(`.v[data-id="${sectionid}_${currentVerse}"]`);

        setReadingVerse(verseEl);

        if (verseEl) {
          const paneTop = offset(pane).top;
          const scrollTop = pane.scrollTop;
          const verseTop = offset(verseEl).top;
          const verseTopAdjusted = verseTop - paneTop + scrollTop;

          if (scroller.setScrollTop) {
            scroller.setScrollTop(verseTopAdjusted);
          } else {
            pane.scrollTop = verseTopAdjusted;
          }
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

    const targetScrollTop = nodeTopAdjusted + scrollOffset;
    if (Math.abs(targetScrollTop - pane.scrollTop) > 4) {
      if (scroller.setScrollTop) {
        scroller.setScrollTop(targetScrollTop);
      } else {
        pane.scrollTop = targetScrollTop;
      }
    }
  });

  const seekToClientX = (clientX) => {
    if (!isFinite(audio.duration) || audio.duration <= 0) return;

    const width = audioSlider.offsetWidth;
    if (width <= 0) return;

    const percent = Math.min(1, Math.max(0, (clientX - offset(audioSlider).left) / width));
    audioSliderHandle.style.left = `${percent * 100}%`;
    audio.currentTime = percent * audio.duration;
  };

  const documentPointerUp = () => {
    isDraggingSliderHandle = false;
    document.removeEventListener('pointermove', documentPointerMove);
    document.removeEventListener('pointerup', documentPointerUp);
    document.removeEventListener('pointercancel', documentPointerUp);
  };

  const documentPointerMove = (e) => {
    seekToClientX(e.clientX);
  };

  audioSliderHandle.style.touchAction = 'none';
  audioSliderHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isDraggingSliderHandle = true;
    document.addEventListener('pointermove', documentPointerMove);
    document.addEventListener('pointerup', documentPointerUp);
    document.addEventListener('pointercancel', documentPointerUp);
  });

  audioSlider.addEventListener('click', (e) => {
    seekToClientX(e.clientX);
  });

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

  const configureBibleBrainDramaOptions = (info) => {
    optionsDramaticBox.style.display = '';

    const hasBoth = info.hasPlainAudio && info.hasDramaAudio;
    optionsDramaticAudio.disabled = !hasBoth;
    optionsDramaticDrama.disabled = !hasBoth;
    optionsDramaticAudio.checked = info.hasPlainAudio;
    optionsDramaticDrama.checked = !info.hasPlainAudio;
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
      audio.removeEventListener('loadeddata', playWhenLoaded);
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
    } else if (audioInfo.type == 'biblebrain') {
      configureBibleBrainDramaOptions(audioInfo);
    } else if (audioInfo.type == 'fcbh') {
      configureFcbhDramaOptions(audioInfo);
    }

    initializeAudioPlayback();

    // loadAudio() shows the toggle button only once the current chapter's audio is
    // confirmed (and hides it otherwise), so don't force it visible here.
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
      const requestId = ++audioRequestId;

      if (!audio.paused && !audio.ended) {
        try {
          audio.pause();
        } catch (e) {
          // ignore
        }
      }
      audio.removeEventListener('loadeddata', playWhenLoaded);
      audio.removeAttribute('src');
      audio.load();

      if (textInfo.type == 'bible') {
        audioDataManager.getAudioInfo(textInfo, (newAudioInfo) => {
          if (block == null || requestId !== audioRequestId) return;
          handleAudioInfoResult(newAudioInfo);
        });
      }
    }
  };

  const size = (width) => {
    block.style.width = `${width}px`;
  };

  const close = () => {
    ext.clearListeners();
    document.removeEventListener('click', docClick);
    isDraggingSliderHandle = false;
    document.removeEventListener('pointermove', documentPointerMove);
    document.removeEventListener('pointerup', documentPointerUp);
    document.removeEventListener('pointercancel', documentPointerUp);

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
