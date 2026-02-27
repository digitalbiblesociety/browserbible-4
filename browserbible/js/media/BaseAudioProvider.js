/**
 * BaseAudioProvider
 * Base class for audio providers. All methods are async and return values (or null).
 * Subclasses must override methods they support.
 */
export class BaseAudioProvider {
  get name() { return 'base'; }

  /**
   * Check if this provider has audio for the given text
   * @param {Object} textInfo - Text metadata (id, abbr, type, etc.)
   * @returns {Promise<Object|null>} audioInfo object or null
   */
  async getAudioInfo(textInfo) { return null; }

  /**
   * Get audio data for a specific fragment (chapter/section)
   * @param {Object} textInfo
   * @param {Object} audioInfo - From getAudioInfo()
   * @param {string} fragmentid - e.g., "GN1_1"
   * @param {string} audioOption - e.g., "drama" or "audio"
   * @returns {Promise<Object|null>} { url, id, start, end, timestamps? } or null
   */
  async getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption) { return null; }

  /**
   * Get fragmentid for the next chapter/section
   * @returns {Promise<string|null>} fragmentid or null
   */
  async getNextFragment(textInfo, audioInfo, fragmentid) { return null; }

  /**
   * Get fragmentid for the previous chapter/section
   * @returns {Promise<string|null>} fragmentid or null
   */
  async getPrevFragment(textInfo, audioInfo, fragmentid) { return null; }
}
