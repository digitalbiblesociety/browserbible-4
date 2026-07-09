// DeafVideoPlayer - single continuous <video> player; a Scroller-compatible drop-in for DeafBibleWindow.

import { elem, secondsToTimeCode } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { Reference } from '../bible/BibleReference.js';
import { getPlaylist } from '../texts/DeafBibleTextProvider.js';
import { DeafPlaylist } from './DeafPlaylist.js';
import playSvg from '../../css/images/audio/play-icon.svg?raw';
import pauseSvg from '../../css/images/audio/pause-icon.svg?raw';
import prevSvg from '../../css/images/audio/previous-icon.svg?raw';
import nextSvg from '../../css/images/audio/next-icon.svg?raw';
import gearSvg from '../../css/images/gear.svg?raw';

const fullscreenSvg = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 4h6V2H2v8h2V4zm16 0v6h2V2h-8v2h6zM4 20v-6H2v8h8v-2H4zm16-6v6h-6v2h8v-8h-2z"/></svg>';

export function DeafVideoPlayer(node) {
  const nodeEl = node?.nodeType ? node : node?.[0];
  nodeEl.innerHTML = '';

  const video = elem('video', { className: 'deaf-video', playsInline: true, preload: 'metadata' });
  const preloadVideo = elem('video', { className: 'deaf-preload', preload: 'auto', style: { display: 'none' } });
  const passageTitle = elem('div', { className: 'deaf-passage-title' });
  const buffering = elem('div', { className: 'deaf-buffering' });
  const stage = elem('div', { className: 'deaf-stage' }, video, preloadVideo, passageTitle, buffering);

  const prevButton = elem('button', { className: 'deaf-btn deaf-prev', type: 'button', title: 'Previous', innerHTML: prevSvg });
  const playButton = elem('button', { className: 'deaf-btn deaf-play', type: 'button', title: 'Play/Pause', innerHTML: playSvg });
  const nextButton = elem('button', { className: 'deaf-btn deaf-next', type: 'button', title: 'Next', innerHTML: nextSvg });
  const currenttime = elem('span', { className: 'deaf-currenttime' }, '00:00');
  const duration = elem('span', { className: 'deaf-duration' }, '00:00');

  const progress = elem('div', { className: 'deaf-playbar-progress' });
  const handle = elem('span', { className: 'deaf-playbar-handle' });
  const markersLayer = elem('div', { className: 'deaf-playbar-markers' });
  const track = elem('div', { className: 'deaf-playbar-track' }, progress, markersLayer, handle);
  const playbar = elem('div', { className: 'deaf-playbar' }, track);

  const fullscreenButton = elem('button', { className: 'deaf-btn deaf-fullscreen', type: 'button', title: 'Fullscreen', innerHTML: fullscreenSvg });
  const optionsButton = elem('button', { className: 'deaf-btn deaf-options', type: 'button', title: 'Options', innerHTML: gearSvg });

  const controls = elem('div', { className: 'deaf-controls' },
    prevButton, playButton, nextButton, currenttime, playbar, duration, fullscreenButton, optionsButton);

  const chapterStrip = elem('div', { className: 'deaf-chapter-strip' });

  const autoplayCheckbox = elem('input', { type: 'checkbox', className: 'deaf-autoplay', checked: true });
  const autoplayLabel = elem('label', {}, autoplayCheckbox, elem('span', {}, 'Autoplay next'));
  const qualityLow = elem('input', { type: 'radio', name: 'deaf-quality', className: 'deaf-quality-low', checked: true });
  const qualityHigh = elem('input', { type: 'radio', name: 'deaf-quality', className: 'deaf-quality-high' });
  const qualityBox = elem('div', { className: 'deaf-quality-box' },
    elem('label', {}, qualityLow, elem('span', {}, 'Standard (360p)')),
    elem('label', {}, qualityHigh, elem('span', {}, 'High')));
  const optionsPanel = elem('div', { className: 'deaf-options-panel', style: { display: 'none' } }, autoplayLabel, qualityBox);

  const player = elem('div', { className: 'deaf-player', tabIndex: 0 }, stage, controls, chapterStrip, optionsPanel);
  nodeEl.appendChild(player);

  let textInfo = null;
  let playlist = null;
  let playlistPromise = null;
  let playlistTextId = null;
  let loadEpoch = 0;

  let currentIndex = -1;
  let currentItem = null;
  let currentChapterTimeline = null;
  let currentBookid = null;
  let locationInfo = null;

  let quality = 'low';
  let isDragging = false;
  let pendingSeekSec = 0;
  let pendingAutoplay = false;
  let consecutiveErrors = 0;

  const MAX_CONSECUTIVE_SKIPS = 3;

  const ensurePlaylist = () => {
    if (playlist && playlistTextId === textInfo?.id) return Promise.resolve(playlist);
    if (playlistPromise && playlistTextId === textInfo?.id) return playlistPromise;

    const requestedId = textInfo?.id;
    playlistTextId = requestedId;
    playlistPromise = getPlaylist(textInfo.id).then((passages) => {
      const pl = DeafPlaylist(passages);
      if (pl.isEmpty) {
        // Don't cache an empty playlist: getPlaylist returns [] on transient errors, so refetch next load
        if (playlistTextId === requestedId) {
          playlist = null;
          playlistPromise = null;
          playlistTextId = null;
        }
        return pl;
      }
      playlist = pl;
      return playlist;
    });
    return playlistPromise;
  };

  const urlFor = (item) => (quality === 'high' ? item.urlHigh : item.urlLow) || item.urlHigh || item.urlLow || '';

  const applyPending = () => {
    if (pendingSeekSec > 0) {
      try { video.currentTime = pendingSeekSec; } catch { /* ignore */ }
    }
    pendingSeekSec = 0;
    if (pendingAutoplay) {
      pendingAutoplay = false;
      video.play().catch(() => {});
    }
  };

  video.addEventListener('loadedmetadata', applyPending);

  const emitLocation = (broadcast) => {
    if (!currentItem) return;

    locationInfo = {
      sectionid: currentItem.sectionid,
      fragmentid: currentItem.fragmentid,
      label: currentItem.reference,
      labelLong: `${currentItem.book} — ${currentItem.reference}`,
      offset: 0
    };

    ext.trigger('locationchange', { type: 'locationchange', target: ext, data: locationInfo });

    if (broadcast) {
      ext.trigger('globalmessage', {
        type: 'globalmessage',
        target: ext,
        data: {
          messagetype: 'nav',
          type: 'deafbible',
          locationInfo
        }
      });
    }
  };

  const buildPlaybar = () => {
    markersLayer.innerHTML = '';
    if (!currentChapterTimeline) return;

    for (const marker of currentChapterTimeline.markers) {
      const tick = elem('span', {
        className: 'deaf-marker',
        title: marker.item.reference,
        style: { left: `${marker.startFraction * 100}%` }
      });
      tick.dataset.index = String(marker.item.index);
      if (marker.item.index === currentIndex) tick.classList.add('active');
      markersLayer.appendChild(tick);
    }
  };

  const currentSegment = () =>
    currentChapterTimeline?.markers.find((m) => m.item.index === currentIndex) ?? null;

  const updatePlayhead = () => {
    const seg = currentSegment();
    const total = currentChapterTimeline?.total ?? 0;
    if (!seg || total <= 0) {
      progress.style.width = '0%';
      if (!isDragging) handle.style.left = '0%';
      return;
    }

    const withinSeg = Math.min(video.currentTime || 0, seg.item.durationSec || video.duration || 0);
    const chapterElapsed = seg.startSec + withinSeg;
    const frac = Math.max(0, Math.min(1, chapterElapsed / total));

    progress.style.width = `${frac * 100}%`;
    if (!isDragging) handle.style.left = `${frac * 100}%`;
    currenttime.textContent = secondsToTimeCode(chapterElapsed);
    duration.textContent = secondsToTimeCode(total);
  };

  const chapterLabel = (sectionid) => sectionid.substring(2);

  const buildChapterStrip = () => {
    chapterStrip.innerHTML = '';
    if (!playlist || !currentItem) return;

    const bookName = elem('span', { className: 'deaf-strip-book' }, currentItem.book);
    chapterStrip.appendChild(bookName);

    for (const sectionid of playlist.sectionsForBook(currentBookid)) {
      const btn = elem('button', {
        className: 'deaf-strip-chapter',
        type: 'button',
        title: Reference(sectionid)?.toString() ?? sectionid
      }, chapterLabel(sectionid));
      btn.dataset.sectionid = sectionid;
      if (sectionid === currentItem.sectionid) btn.classList.add('active');
      chapterStrip.appendChild(btn);
    }

    const active = chapterStrip.querySelector('.deaf-strip-chapter.active');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  };

  const setCurrentIndex = (index, { autoplay = false, seekSec = 0, suppressBroadcast = false } = {}) => {
    if (!playlist) return;
    const item = playlist.get(index);
    if (!item) return;

    const itemChanged = !currentItem || currentItem.index !== item.index;
    const sectionChanged = !currentItem || currentItem.sectionid !== item.sectionid;
    const bookChanged = currentBookid !== item.bookid;

    currentIndex = index;
    currentItem = item;
    currentBookid = item.bookid;

    passageTitle.textContent = item.reference;

    if (itemChanged) {
      const url = urlFor(item);
      if (!url) {
        // Don't set video.src='' (it resolves to the page URL and errors); drop the attr and skip forward
        if (video.getAttribute('src')) { video.removeAttribute('src'); video.load(); }
        consecutiveErrors++;
        const skipIndex = playlist.next(currentIndex);
        if (consecutiveErrors <= MAX_CONSECUTIVE_SKIPS && skipIndex > -1) {
          setCurrentIndex(skipIndex, { autoplay, suppressBroadcast });
          return;
        }
      } else if (video.getAttribute('src') !== url) {
        pendingSeekSec = seekSec;
        pendingAutoplay = autoplay;
        video.poster = item.poster || '';
        video.src = url;
        video.load();
      } else {
        if (seekSec > 0) { try { video.currentTime = seekSec; } catch { /* ignore */ } }
        if (autoplay) video.play().catch(() => {});
      }
      preloadNext();
    } else if (seekSec > 0) {
      try { video.currentTime = seekSec; } catch { /* ignore */ }
      if (autoplay) video.play().catch(() => {});
    }

    if (sectionChanged) {
      currentChapterTimeline = playlist.chapterTimeline(item.sectionid);
      buildPlaybar();
    } else {
      markersLayer.querySelectorAll('.deaf-marker.active').forEach((m) => m.classList.remove('active'));
      markersLayer.querySelector(`.deaf-marker[data-index="${index}"]`)?.classList.add('active');
    }

    if (bookChanged || sectionChanged) buildChapterStrip();

    updatePlayhead();
    emitLocation(!suppressBroadcast);
  };

  const preloadNext = () => {
    const nextIndex = playlist?.next(currentIndex) ?? -1;
    const nextItem = nextIndex > -1 ? playlist.get(nextIndex) : null;
    const url = nextItem ? urlFor(nextItem) : '';
    if (url && preloadVideo.getAttribute('src') !== url) {
      preloadVideo.src = url;
    }
  };

  const togglePlay = () => {
    if (!video.getAttribute('src')) {
      if (currentItem) setCurrentIndex(currentIndex, { autoplay: true, suppressBroadcast: true });
      return;
    }
    if (video.paused || video.ended) video.play().catch(() => {});
    else video.pause();
  };

  const goPrev = () => {
    const i = playlist?.prev(currentIndex) ?? -1;
    if (i > -1) setCurrentIndex(i, { autoplay: !video.paused });
  };

  const goNext = (autoplay) => {
    const i = playlist?.next(currentIndex) ?? -1;
    if (i > -1) setCurrentIndex(i, { autoplay });
  };

  playButton.addEventListener('click', togglePlay);
  prevButton.addEventListener('click', goPrev);
  nextButton.addEventListener('click', () => goNext(!video.paused));

  const handlePlaying = () => {
    playButton.innerHTML = pauseSvg;
    playButton.classList.add('playing');
    buffering.classList.remove('active');

    document.querySelectorAll('audio,video').forEach((el) => {
      if (el !== video && el !== preloadVideo && !el.paused && !el.ended) el.pause();
    });
  };
  const handlePaused = () => {
    playButton.innerHTML = playSvg;
    playButton.classList.remove('playing');
  };

  video.addEventListener('play', handlePlaying);
  video.addEventListener('playing', handlePlaying);
  video.addEventListener('pause', handlePaused);
  video.addEventListener('timeupdate', updatePlayhead);
  video.addEventListener('waiting', () => buffering.classList.add('active'));
  video.addEventListener('canplay', () => {
    buffering.classList.remove('active');
    consecutiveErrors = 0;
  });

  video.addEventListener('ended', () => {
    handlePaused();
    if (autoplayCheckbox.checked) goNext(true);
  });

  // On error, retry the other quality once, then skip forward (bounded by MAX_CONSECUTIVE_SKIPS)
  video.addEventListener('error', () => {
    if (!currentItem || !video.getAttribute('src')) return;
    buffering.classList.remove('active');
    const item = currentItem;
    const alt = quality === 'high' ? item.urlLow : item.urlHigh;
    if (alt && video.getAttribute('src') !== alt) {
      video.src = alt;
      video.load();
      return;
    }
    consecutiveErrors++;
    if (consecutiveErrors <= MAX_CONSECUTIVE_SKIPS) goNext(true);
  });

  const seekToFraction = (fraction) => {
    if (!currentChapterTimeline) return;
    const total = currentChapterTimeline.total;
    const targetSec = Math.max(0, Math.min(1, fraction)) * total;

    const seg = currentChapterTimeline.markers.find((m) => targetSec >= m.startSec && targetSec < m.endSec)
      ?? currentChapterTimeline.markers[currentChapterTimeline.markers.length - 1];
    if (!seg) return;

    const withinSeg = targetSec - seg.startSec;
    if (seg.item.index === currentIndex) {
      try { video.currentTime = withinSeg; } catch { /* ignore */ }
    } else {
      setCurrentIndex(seg.item.index, { seekSec: withinSeg, autoplay: !video.paused });
    }
  };

  const fractionFromEvent = (clientX) => {
    const rect = track.getBoundingClientRect();
    return rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  };

  track.addEventListener('click', (e) => {
    if (e.target.classList.contains('deaf-marker')) return;
    seekToFraction(fractionFromEvent(e.clientX));
  });

  markersLayer.addEventListener('click', (e) => {
    const marker = e.target.closest('.deaf-marker');
    if (!marker) return;
    e.stopPropagation();
    setCurrentIndex(parseInt(marker.dataset.index, 10), { autoplay: !video.paused });
  });

  const onDragMove = (e) => {
    if (!isDragging) return;
    const frac = Math.max(0, Math.min(1, fractionFromEvent(e.clientX)));
    handle.style.left = `${frac * 100}%`;
  };
  const onDragUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    seekToFraction(fractionFromEvent(e.clientX));
  };
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
  });

  chapterStrip.addEventListener('click', (e) => {
    const btn = e.target.closest('.deaf-strip-chapter');
    if (!btn) return;
    const index = playlist?.indexOfSection(btn.dataset.sectionid) ?? -1;
    if (index > -1) setCurrentIndex(index, { autoplay: !video.paused });
  });

  const docClick = (e) => {
    if (!optionsPanel.contains(e.target) && e.target !== optionsButton && !optionsButton.contains(e.target)) {
      optionsPanel.style.display = 'none';
      document.removeEventListener('click', docClick);
    }
  };
  optionsButton.addEventListener('click', () => {
    if (optionsPanel.style.display !== 'none') {
      optionsPanel.style.display = 'none';
      document.removeEventListener('click', docClick);
    } else {
      optionsPanel.style.display = '';
      setTimeout(() => document.addEventListener('click', docClick));
    }
  });

  const changeQuality = () => {
    quality = qualityHigh.checked ? 'high' : 'low';
    if (!currentItem) return;
    const wasPlaying = !video.paused;
    const at = video.currentTime;
    pendingSeekSec = at;
    pendingAutoplay = wasPlaying;
    video.src = urlFor(currentItem);
    video.load();
    preloadNext();
  };
  qualityLow.addEventListener('change', changeQuality);
  qualityHigh.addEventListener('change', changeQuality);

  fullscreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else stage.requestFullscreen?.();
  });

  player.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') { try { video.currentTime += 5; } catch { /* ignore */ } }
    else if (e.key === 'ArrowLeft') { try { video.currentTime -= 5; } catch { /* ignore */ } }
    else if (e.key === 'n') goNext(!video.paused);
    else if (e.key === 'p') goPrev();
  });

  const setTextInfo = (newTextInfo) => {
    if (textInfo && newTextInfo && textInfo.id === newTextInfo.id) return;
    textInfo = newTextInfo;
    playlist = null;
    playlistPromise = null;
    playlistTextId = null;
    currentIndex = -1;
    currentItem = null;
    currentChapterTimeline = null;
    currentBookid = null;
    locationInfo = null;

    if (!video.paused) { try { video.pause(); } catch { /* ignore */ } }
    video.removeAttribute('src');
    video.load();
    passageTitle.textContent = '';
    markersLayer.innerHTML = '';
    chapterStrip.innerHTML = '';
  };

  const load = (loadType, sectionid, fragmentid) => {
    const epoch = ++loadEpoch;
    ensurePlaylist().then((pl) => {
      if (epoch !== loadEpoch || !pl) return;
      if (pl.isEmpty) return;

      let index = fragmentid ? pl.indexOfFragment(fragmentid) : -1;
      if (index < 0 && sectionid) index = pl.indexOfSection(sectionid);
      if (index < 0) index = 0;

      setCurrentIndex(index, { autoplay: false, suppressBroadcast: true });
      ext.trigger('load', { type: 'load', target: ext, data: locationInfo });
    });
  };

  const scrollTo = (fragmentid) => {
    if (fragmentid == null || !playlist) return;
    const index = playlist.indexOfFragment(fragmentid);
    if (index > -1) setCurrentIndex(index, { autoplay: false, suppressBroadcast: true });
  };

  const broadcastCurrentContent = () => {
    if (currentItem) emitLocation(true);
  };

  const getLocationInfo = () => locationInfo;
  const getTextInfo = () => textInfo;
  const setFocus = () => {};
  const size = () => {};

  const close = () => {
    ext.clearListeners();
    document.removeEventListener('click', docClick);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    if (!video.paused) { try { video.pause(); } catch { /* ignore */ } }
    video.removeAttribute('src');
    preloadVideo.removeAttribute('src');
    if (player.parentNode) player.parentNode.removeChild(player);
  };

  const ext = {
    setTextInfo,
    load,
    scrollTo,
    getLocationInfo,
    getTextInfo,
    broadcastCurrentContent,
    setFocus,
    size,
    close
  };

  mixinEventEmitter(ext);
  ext._events = {};

  return ext;
}
