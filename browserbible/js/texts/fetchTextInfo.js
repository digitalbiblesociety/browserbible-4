import { getConfig } from '../core/config.js';

/**
 * Fetch and cache text info JSON for a given content path.
 * @param {Object} cache - Cache object to store/retrieve results
 * @param {string} contentPath - Path segment (e.g. 'content/texts' or 'content/commentaries')
 * @param {string} textid - Text identifier
 * @param {Function} callback - Success callback receiving the data
 * @param {Function} [errorCallback] - Error callback
 */
export function fetchTextInfo(cache, contentPath, textid, callback, errorCallback) {
  if (cache[textid] !== undefined) {
    callback(cache[textid]);
    return;
  }

  const config = getConfig();
  const infoUrl = `${config.baseContentUrl}${contentPath}/${textid}/info.json`;

  fetch(infoUrl)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      cache[textid] = data;
      callback(data);
    })
    .catch(error => {
      console.error(`ERROR fetchTextInfo: ${infoUrl}`);
      errorCallback?.(error);
    });
}
