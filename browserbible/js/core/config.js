/**
 * Application Configuration
 * Central configuration management with defaults and custom overrides
 */

import { bibleBrainExcludeIds } from '../data/biblebrainDuplicates.js';

const defaultConfig = {
  settingsPrefix: '20260501',

  enableOnlineSources: true,

  windows: [
    { type: 'bible', data: { textid: 'ENGWEB', fragmentid: 'JN1_1' } },
    { type: 'bible', data: { textid: 'ENGASV', fragmentid: 'JN1_1' } }
  ],

  baseContentUrl: 'https://inscript.bible.cloud/',
  textsPath: 'content/texts',
  baseContentApiPath: '',
  baseContentApiKey: '',
  textsIndexPath: 'texts.json',
  aboutPagePath: 'about.html',
  serverSearchPath: 'https://arc.dbs.org/api/bible-search/',
  topTexts: [],

  // API.Bible provider. The frontend never holds the api-key; it only talks to
  // the proxy worker, which adds it. apiBibleProxyBase points at that proxy
  // (no trailing slash), e.g. http://localhost:8787/v1 for local wrangler dev.
  apiBibleEnabled: true,
  // Baked per build profile (sites/{profile}.json -> vite define): localhost for
  // dev, https://api.inscript.org/abs/v1 for the inscript build.
  apiBibleProxyBase: (typeof __API_BIBLE_PROXY_BASE__ !== 'undefined')
    ? __API_BIBLE_PROXY_BASE__
    : 'http://localhost:8787/v1',
  // FUMS fair-use reporting is all done server-side by the proxy, so there's no
  // frontend FUMS config here.
  // Which API.Bible Bible IDs to show (NIV, CSB, NLT). The proxy enforces the
  // same list server-side.
  apiBibleIncludeIds: [
    '78a9f6124f344018-01', // NIV
    'a556c5305ee15c3f-01', // CSB
    'd6e14a625393b4da-01'  // NLT
  ],

  bibleBrainEnabled: true,
  bibleBrainProxyBase: (typeof __BIBLE_BRAIN_PROXY_BASE__ !== 'undefined')
    ? __BIBLE_BRAIN_PROXY_BASE__
    : '',
  bibleBrainLanguages: [],
  // Bible Brain texts that duplicate an existing DBS/inscript text (see
  // js/data/biblebrainDuplicates.js).
  bibleBrainExcludeIds,

  newBibleWindowVersion: 'ENGWEB',
  newWindowFragmentid: 'JN1_1',
  newCommentaryWindowTextId: 'commentary:ENGWES',
  newComparisonWindowSourceVersion: 'ENGWEB',
  newComparisonWindowTargetVersion: 'ENGKJV',

  pinnedLanguage: 'English',
  pinnedLanguages: ['English', 'Spanish'],
  defaultLanguage: '',

  customCssUrl: '',
  dbsAudioEnabled: true,
  dbsAudioUrl: 'https://audio.dbs.org',
  // Local per-text audio manifests (content/audio/{id}/info.json) only exist for
  // locally-served content; probing them against the remote CDN just 404s, so
  // this stays off by default and is enabled in the 'local' preset below.
  localAudioEnabled: false,

  // Window defaults
  enableAudioWindow: true,
  audioWindowDefaultBibleFragmentid: 'JN1_1',
  audioWindowDefaultBibleVersion: 'ENGESV',
  enableDeafBibleWindow: true,
  deafBibleWindowDefaultBibleFragmentid: 'JN1_1',
  deafBibleWindowDefaultBibleVersion: 'deaf_ASE',
  deafBibleEnabled: true,
  deafBibleMetaUrl: 'https://meta.dbs.org/video/DeafBible',

  // Menu components
  enableNavigationButtons: true,
  enableUrlCopier: true,
  enableRestore: false,
  enableThemeSelector: true,
  enableLanguageSelector: true,
  languageSelectorFallbackLang: 'en',
  enableFontSizeSelector: true,
  fontSizeMin: 14,
  fontSizeMax: 28,
  fontSizeDefault: 18,
  enableFontFamilySelector: true,
  fontFamilyStacks: {
    'Cambria': 'Cambria, Georgia, serif',
    'Georgia': 'Georgia, serif',
    'Palatino': '"Palatino Linotype", "Book Antiqua", Palatino, serif',
    'Times': '"Times New Roman", Times, serif',
    'Arial': 'Arial, Helvetica, sans-serif',
    'Lucida': '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
    'Trebuchet': '"Trebuchet MS", Helvetica, sans-serif',
    'Verdana': 'Verdana, Geneva, sans-serif'
  },
  enableSettingToggles: true,
  settingToggleNames: ['Chapters', 'Verses', 'Titles', 'Notes', 'Words of Christ', 'Media', 'Justify'],
  settingToggleDefaults: [true, true, true, true, true, true, false],
  enableFeedback: false,
  feedbackUrl: '',
  windowTypesOrder: [],
  disabledWindowTypes: (typeof __DISABLED_WINDOW_TYPES__ !== 'undefined') ? __DISABLED_WINDOW_TYPES__ : [],
  _disabledFeatures: (typeof __DISABLED_FEATURES__ !== 'undefined') ? __DISABLED_FEATURES__ : [],

  enableCrossReferencePopupPlugin: true,
  enableNotesPopupPlugin: true,
  enableLemmaPopupPlugin: true,
  enableLemmaInfoPlugin: true,
  enableLemmaMatchPlugin: true,
  enableVerseMatchPlugin: true,
  enableVisualFilters: true,
  enableHighlighterPlugin: true,
  enableMediaLibraryPlugin: true,
  enableEng2pPlugin: true,
  eng2pEnableAll: true,
  eng2pDefaultSetting: 'none',
  eng2pShowWindowAtStartup: false
};

const customConfigs = {
  local: {
    baseContentUrl: '',
    localAudioEnabled: true,
    serverSearchPath: '',
    windows: [
      { type: 'bible', data: { textid: 'ENGWEB', fragmentid: 'JN1_1' } },
      { type: 'bible', data: { textid: 'SPABES', fragmentid: 'JN1_1' } }
    ],
    newBibleWindowVersion: 'ENGWEB',
    newComparisonWindowSourceVersion: 'ENGWEB',
    newComparisonWindowTargetVersion: 'SPABES',
    audioWindowDefaultBibleVersion: 'ENGWEB'
  }
};

const config = { ...defaultConfig };

for (const key of config._disabledFeatures) {
  if (key in config) config[key] = false;
}

if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'true') {
  config.textsPath = 'content/texts_dev';
}

/**
 * Get the current configuration object
 * @returns {Object} Current config
 */
export const getConfig = () => config;

/**
 * Merge new values into the configuration
 * @param {Object} newConfig - Config values to merge
 * @returns {Object} Updated config
 */
export const updateConfig = (newConfig) => {
  Object.assign(config, newConfig);
  return config;
};

/**
 * Get a named custom configuration preset
 * @param {string} name - Preset name
 * @returns {Object|null} Custom config or null
 */
export const getCustomConfig = (name) => customConfigs[name] ?? null;
