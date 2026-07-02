/**
 * Media Module Index
 * Imported once (`import './media/index.js'`) for side effects: registering audio
 * providers and exposing window.MediaLibrary. Nothing imports its members.
 */

import { getConfig } from '../core/config.js';
import './audioProviders.js';

const fetchLibraryInfo = (library, baseUrl) => {
  let infoUrl;
  if (library.infoUrl) {
    infoUrl = library.infoUrl;
  } else if (library.baseUrl) {
    infoUrl = `content/media/${library.folder}/info.json`;
  } else {
    infoUrl = `${baseUrl}content/media/${library.folder}/info.json`;
  }
  return fetch(infoUrl)
    .then(response => {
      if (!response.ok) {
        console.warn(`Failed to load info.json for ${library.folder}`);
        return null;
      }
      return response.json();
    })
    .then(data => {
      if (data) {
        return {
          ...library,
          data: data
        };
      }
      return null;
    })
    .catch(err => {
      console.warn(`Error loading ${library.folder}/info.json:`, err);
      return null;
    });
};

const MediaLibrary = (() => {
  let mediaLibraries = null;
  let isLoading = false;
  const pendingCallbacks = [];

  const loadMediaLibraries = () => {
    if (isLoading) return;
    isLoading = true;

    const config = getConfig();
    const baseUrl = config.baseContentUrl || '';

    const localMediaJsonUrl = 'content/media/media.json';
    const remoteMediaJsonUrl = `${baseUrl}content/media/media.json`;

    fetch(localMediaJsonUrl)
      .then(response => {
        if (response.ok) return response.json();

        return fetch(remoteMediaJsonUrl).then(r => {
          if (!r.ok) throw new Error(`Failed to load media.json: ${r.status}`);
          return r.json();
        });
      })
      .then(mediaConfig => {
        const libraries = mediaConfig.media || [];
        const loadPromises = libraries.map(library => fetchLibraryInfo(library, baseUrl));
        return Promise.all(loadPromises);
      })
      .then(results => {
        const loaded = results.filter(lib => lib !== null);
        // all listed libraries failing is a network problem, not an empty catalog
        if (results.length > 0 && loaded.length === 0) {
          throw new Error('no media library info.json could be loaded');
        }
        mediaLibraries = loaded;
        isLoading = false;

        while (pendingCallbacks.length > 0) {
          const callback = pendingCallbacks.shift();
          callback(mediaLibraries);
        }
      })
      .catch(err => {
        console.error('Error loading media libraries:', err);
        // mediaLibraries stays null so the next caller retries; a startup
        // network blip shouldn't hide media for the whole session
        isLoading = false;

        while (pendingCallbacks.length > 0) {
          const callback = pendingCallbacks.shift();
          callback([]);
        }
      });
  };

  return {
    getMediaLibraries(callback) {
      if (mediaLibraries !== null) {
        callback(mediaLibraries);
        return;
      }

      pendingCallbacks.push(callback);
      loadMediaLibraries();
    },

    show() {},

    hide() {}
  };
})();

if (typeof window !== 'undefined') {
  window.MediaLibrary = MediaLibrary;
}
