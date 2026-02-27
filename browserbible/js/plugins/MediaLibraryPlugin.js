/**
 * MediaLibraryPlugin
 * Adds media icons to verses and shows media popups
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { InfoWindow } from '../ui/InfoWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';

/**
 * Build the full URL for a media file
 */
function getMediaUrl(mediaLibrary, filename, ext, suffix) {
  const config = getConfig();
  if (mediaLibrary.baseUrl) {
    return `${mediaLibrary.baseUrl}${filename}${suffix || '.' + ext}`;
  }
  return `${config.baseContentUrl}content/media/${mediaLibrary.folder}/${filename}${suffix || '.' + ext}`;
}

/**
 * Create a media library plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const MediaLibraryPlugin = (app) => {
  const config = getConfig();

  if (!config.enableMediaLibraryPlugin) {
    return {};
  }

  let mediaLibraries = null;
  const mediaPopup = InfoWindow('mediapopup');
  const contentToProcess = [];

  // Get MediaLibrary from global if available
  const MediaLibrary = window.MediaLibrary;

  const showImagePopup = (icon, mediaLibrary, mediaForVerse, reference) => {
    const bodyEl = mediaPopup.body;
    bodyEl.innerHTML = '';

    let html = '';
    for (const mediaInfo of mediaForVerse) {
      const ext = Array.isArray(mediaInfo.exts) ? mediaInfo.exts[0] : mediaInfo.exts;
      const fullUrl = getMediaUrl(mediaLibrary, mediaInfo.filename, ext, mediaLibrary.largeSuffix);
      const thumbUrl = getMediaUrl(mediaLibrary, mediaInfo.filename, ext, mediaLibrary.thumbSuffix || null);
      html += `<li><a href="${fullUrl}" target="_blank"><img src="${thumbUrl}" /></a></li>`;
    }

    bodyEl.appendChild(elem('strong', {}, reference));
    bodyEl.appendChild(elem('ul', { className: 'inline-image-library-thumbs', innerHTML: html }));
    mediaPopup.position(icon).show();
  };

  const showVideo = (icon, mediaLibrary, mediaForVerse) => {
    const videoMediaInfo = mediaForVerse[0];
    const videoExt = Array.isArray(videoMediaInfo.exts) ? videoMediaInfo.exts[0] : videoMediaInfo.exts;
    const videoUrl = getMediaUrl(mediaLibrary, videoMediaInfo.filename, videoExt);

    showVideoPopup(icon, videoUrl, videoMediaInfo.name || videoMediaInfo.filename);
  };

  const showJfmVideo = (icon, mediaLibrary, mediaForVerse) => {
    const section = icon.closest('.section');
    const lang = section?.getAttribute('data-lang3') ?? 'eng';
    const jfmMediaInfo = mediaForVerse[0];
    const JesusFilmMediaApi = window.JesusFilmMediaApi;

    if (!JesusFilmMediaApi) {
      // Fallback to static file if API not available
      const ext = Array.isArray(jfmMediaInfo.exts) ? jfmMediaInfo.exts[0] : jfmMediaInfo.exts;
      if (ext) {
        const staticUrl = getMediaUrl(mediaLibrary, jfmMediaInfo.filename, ext);
        showVideoPopup(icon, staticUrl, jfmMediaInfo.name || jfmMediaInfo.filename);
      }
      return;
    }

    JesusFilmMediaApi.getPlayer(lang, jfmMediaInfo.filename, (videoUrl, videoLang) => {
      if (videoUrl !== null) {
        const langSuffix = lang !== videoLang ? ' / ' + lang : '';
        const title = (jfmMediaInfo.name || jfmMediaInfo.filename) + ' (' + videoLang + langSuffix + ')';
        showVideoPopup(icon, videoUrl, title);
      } else {
        const ext = Array.isArray(jfmMediaInfo.exts) ? jfmMediaInfo.exts[0] : jfmMediaInfo.exts;
        if (ext) {
          const staticUrl = getMediaUrl(mediaLibrary, jfmMediaInfo.filename, ext);
          showVideoPopup(icon, staticUrl, jfmMediaInfo.name || jfmMediaInfo.filename);
        }
      }
    });
  };

  const showVideoPopup = (icon, videoUrl, title) => {
    const bodyEl = mediaPopup.body;
    bodyEl.innerHTML = '';

    if (title) {
      bodyEl.appendChild(elem('strong', {}, title));
    }

    const video = elem('video', {
      controls: true,
      autoplay: true,
      style: 'width:100%;max-height:300px;margin-top:8px;border-radius:4px;'
    });
    video.src = videoUrl;
    bodyEl.appendChild(video);

    // Stop playback when popup closes
    const stopHandler = () => {
      video.pause();
      video.src = '';
      mediaPopup.off('hide', stopHandler);
    };
    mediaPopup.on('hide', stopHandler);

    mediaPopup.position(icon).show();
  };

  const setupMediaEvents = () => {
    const windowsMain = document.querySelector('.windows-main');
    if (!windowsMain) return;

    windowsMain.addEventListener('click', (e) => {
      const icon = e.target.closest('.mediathumb');
      if (!icon) return;

      const mediaFolder = icon.getAttribute('data-mediafolder');
      const verse = icon.closest('.verse, .v');
      const verseid = verse?.getAttribute('data-id') ?? '';
      const ref = Reference(verseid);
      const reference = ref ? ref.toString() : verseid;
      const mediaLibrary = mediaLibraries.find(ml => ml.folder === mediaFolder);

      if (!mediaLibrary) return;

      const mediaForVerse = mediaLibrary.data?.[verseid];
      if (!mediaForVerse || mediaForVerse.length === 0) return;

      if (mediaLibrary.type === 'image') showImagePopup(icon, mediaLibrary, mediaForVerse, reference);
      else if (mediaLibrary.type === 'video') showVideo(icon, mediaLibrary, mediaForVerse);
      else if (mediaLibrary.type === 'jfm') showJfmVideo(icon, mediaLibrary, mediaForVerse);
    });
  };

  // process chapters, add image icon to verses
  const addMedia = () => {
    if (mediaLibraries === null) {
      return;
    }

    while (contentToProcess.length > 0) {
      const content = contentToProcess.pop();

      // Handle content which may be string, DOM element, or jQuery object
      let contentEl;
      if (typeof content === 'string') {
        const temp = document.createElement('div');
        temp.innerHTML = content;
        contentEl = temp;
      } else {
        contentEl = content;
      }

      if (contentEl.getAttribute('data-has-media') !== null) {
        continue;
      }

      // add images to verses
      contentEl.querySelectorAll('.verse, .v').forEach(function(verse) {
        const verseid = verse.getAttribute('data-id');

        // make sure we're just doing the first verse
        const section = verse.closest('.section');
        if (section) {
          verse = section.querySelector(`.${verseid}`) ?? verse;
        }

        if (!verse.classList.contains('has-media')) {
          // check all libraries
          for (const mediaLibrary of mediaLibraries) {
            const iconClassName = mediaLibrary.iconClassName;
            const mediaForVerse = mediaLibrary.data?.[verseid];

            // add media
            if (mediaForVerse !== undefined) {
              const iconEl = elem('span', { className: `inline-icon ${iconClassName} mediathumb`, dataset: { mediafolder: mediaLibrary.folder } });
              const verseNumber = verse.querySelector('.verse-num, .v-num');

              if (verseNumber) {
                verseNumber.parentNode.insertBefore(iconEl, verseNumber.nextSibling);
              } else {
                verse.insertBefore(iconEl, verse.firstChild);
              }
            }
          }

          if (section) {
            section.querySelectorAll(`.${verseid}`).forEach((v) => {
              v.classList.add('has-media');
            });
          }
        }
      });

      contentEl.setAttribute('data-has-media', 'true');
    }
  };

  if (MediaLibrary?.getMediaLibraries) {
    MediaLibrary.getMediaLibraries((data) => {
      mediaLibraries = data;

      setupMediaEvents();
      addMedia();
    });
  }

  let ext = {};
  mixinEventEmitter(ext);

  ext.on('message', (e) => {
    if (e.data.messagetype === 'textload' && e.data.type === 'bible') {
      // store
      contentToProcess.push(e.data.content);
      // run
      addMedia();
    }
  });

  return ext;
};

export default MediaLibraryPlugin;
