/**
 * ArclightApi
 * Interface to the Arclight API for Jesus Film video content
 * @see https://api.arclight.org/v2
 */

import { getConfig } from '../core/config.js';

const cache = {
  languageMap: {},      // iso3 -> languageId
  mediaComponents: {},  // cacheKey -> data
  chapters: {}
};

const JESUS_FILM_ID = '1_jf-0-0';
const ENGLISH_LANGUAGE_ID = 529;

async function apiRequest(endpoint, params = {}) {
  const config = getConfig();
  const baseUrl = config.arclightApiUrl || 'https://api.arclight.org/v2';
  const apiKey = config.arclightApiKey;

  if (!apiKey) {
    throw new Error('Arclight API key not configured');
  }

  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set('apiKey', apiKey);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Arclight API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get Arclight language ID from ISO code
 * @param {string} langCode - ISO-639-3 or BCP-47 language code
 * @returns {Promise<number|null>} Arclight language ID
 */
export async function getLanguageId(langCode) {
  if (!langCode) return ENGLISH_LANGUAGE_ID;

  const code = langCode.toLowerCase();

  if (cache.languageMap[code]) {
    return cache.languageMap[code];
  }

  try {
    const params = code.length === 3 ? { iso3: code } : { bcp47: code };
    const data = await apiRequest('/media-languages', params);
    let languages = data._embedded?.mediaLanguages || [];

    if (languages.length === 0 && code.length === 3) {
      const bcp47Data = await apiRequest('/media-languages', { bcp47: code.substring(0, 2) });
      languages = bcp47Data._embedded?.mediaLanguages || [];
    }

    if (languages.length > 0) {
      let bestMatch = languages[0];
      for (const lang of languages) {
        if (!lang.name.includes(',') && !lang.name.includes('(')) {
          bestMatch = lang;
          break;
        }
      }
      const langId = bestMatch.languageId;
      cache.languageMap[code] = langId;
      return langId;
    }

    return null;
  } catch (err) {
    console.warn('Error fetching language from Arclight:', err.message);
    return null;
  }
}

/**
 * Get all Jesus Film chapter IDs
 * @returns {Promise<string[]>} Array of chapter media component IDs
 */
export async function getJesusFilmChapters() {
  if (cache.chapters[JESUS_FILM_ID]) {
    return cache.chapters[JESUS_FILM_ID];
  }

  try {
    const data = await apiRequest(`/media-component-links/${JESUS_FILM_ID}`);
    const chapters = data.linkedMediaComponentIds?.contains || [];

    if (chapters.length > 0) {
      cache.chapters[JESUS_FILM_ID] = chapters;
    }

    return chapters;
  } catch (err) {
    console.warn('Error fetching Jesus Film chapters:', err.message);
    return [];
  }
}

/**
 * Get video content details
 * @param {string} mediaComponentId - Media component ID
 * @param {number} languageId - Arclight language ID
 * @returns {Promise<Object|null>} Video content data
 */
export async function getVideoContent(mediaComponentId, languageId) {
  const cacheKey = `${mediaComponentId}_${languageId}`;

  if (cache.mediaComponents[cacheKey]) {
    return cache.mediaComponents[cacheKey];
  }

  try {
    const data = await apiRequest(`/media-components/${mediaComponentId}/languages/${languageId}`, { platform: 'web' });

    const result = {
      mediaComponentId,
      languageId,
      title: data.title,
      lengthInMilliseconds: data.lengthInMilliseconds,
      downloadUrls: data.downloadUrls,
      streamingUrls: data.streamingUrls,
      subtitleUrls: data.subtitleUrls,
      imageUrls: data.imageUrls
    };

    cache.mediaComponents[cacheKey] = result;
    return result;
  } catch (err) {
    console.warn(`Error fetching video content for ${mediaComponentId}:`, err.message);
    return null;
  }
}

/**
 * Get Jesus Film chapter by language and chapter number
 * @param {string} iso3 - ISO-639-3 language code
 * @param {number|string} chapterNumber - Chapter number (1-based)
 * @returns {Promise<Object|null>} Video content data
 */
export async function getJesusFilmChapter(iso3, chapterNumber) {
  let languageId = await getLanguageId(iso3);

  if (!languageId) {
    languageId = ENGLISH_LANGUAGE_ID;
  }

  return getJesusFilmChapterByLangId(languageId, chapterNumber);
}

async function getJesusFilmChapterByLangId(languageId, chapterNumber) {
  const chapters = await getJesusFilmChapters();
  const chapterIndex = parseInt(chapterNumber, 10) - 1;

  if (chapterIndex < 0 || chapterIndex >= chapters.length) {
    console.warn(`Invalid chapter number: ${chapterNumber}`);
    return null;
  }

  const chapterId = chapters[chapterIndex];
  return getVideoContent(chapterId, languageId);
}

/**
 * Get streaming URL for a Jesus Film chapter
 * @param {string} iso3 - ISO-639-3 language code
 * @param {number|string} chapterNumber - Chapter number
 * @returns {Promise<Object|null>} Streaming data with url, type, title, etc.
 */
export async function getJesusFilmStreamingUrl(iso3, chapterNumber) {
  const videoData = await getJesusFilmChapter(iso3, chapterNumber);

  if (!videoData) return null;

  const streamingUrls = videoData.streamingUrls || {};
  const downloadUrls = videoData.downloadUrls || {};

  let streamUrl = null;
  let streamType = null;

  if (streamingUrls.hls?.length > 0) {
    streamUrl = streamingUrls.hls[0].url;
    streamType = 'hls';
  } else if (streamingUrls.m3u8?.length > 0) {
    streamUrl = streamingUrls.m3u8[0].url;
    streamType = 'm3u8';
  } else if (streamingUrls.dash?.length > 0) {
    streamUrl = streamingUrls.dash[0].url;
    streamType = 'dash';
  } else if (streamingUrls.http?.length > 0) {
    streamUrl = streamingUrls.http[0].url;
    streamType = 'http';
  }

  if (!streamUrl) {
    if (downloadUrls.high?.url) {
      streamUrl = downloadUrls.high.url;
      streamType = 'mp4';
    } else if (downloadUrls.low?.url) {
      streamUrl = downloadUrls.low.url;
      streamType = 'mp4';
    }
  }

  if (!streamUrl) return null;

  return {
    url: streamUrl,
    type: streamType,
    title: videoData.title,
    thumbnail: videoData.imageUrls?.thumbnail,
    poster: videoData.imageUrls?.videoStill,
    duration: videoData.lengthInMilliseconds,
    subtitles: videoData.subtitleUrls
  };
}

/**
 * Get all available languages for Jesus Film
 * @returns {Promise<Array>} Array of language objects
 */
export async function getAvailableLanguages() {
  try {
    const data = await apiRequest(`/media-components/${JESUS_FILM_ID}/languages`);
    return data._embedded?.mediaComponentLanguage || [];
  } catch (err) {
    console.warn('Error fetching available languages:', err.message);
    return [];
  }
}

/** Clear all cached data */
export function clearCache() {
  cache.languageMap = {};
  cache.mediaComponents = {};
  cache.chapters = {};
}

/**
 * Legacy API interface for backwards compatibility
 */
export const JesusFilmMediaApi = {
  async getPlayer(lang, filename, callback) {
    try {
      const result = await getJesusFilmStreamingUrl(lang, filename);

      if (result) {
        callback(result.url, lang);
      } else if (lang !== 'eng') {
        const fallbackResult = await getJesusFilmStreamingUrl('eng', filename);
        if (fallbackResult) {
          callback(fallbackResult.url, 'eng');
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    } catch (err) {
      console.warn('Error in JesusFilmMediaApi.getPlayer:', err.message);
      callback(null);
    }
  },

  getVideoData: (lang, filename) => getJesusFilmStreamingUrl(lang, filename)
};

if (typeof window !== 'undefined') {
  window.JesusFilmMediaApi = JesusFilmMediaApi;
}

export default {
  getLanguageId,
  getJesusFilmChapters,
  getVideoContent,
  getJesusFilmChapter,
  getJesusFilmStreamingUrl,
  getAvailableLanguages,
  clearCache,
  JesusFilmMediaApi
};
