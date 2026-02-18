/**
 * Application Configuration
 * Central configuration management with defaults and custom overrides
 */

const defaultConfig = {
  settingsPrefix: '20140307', // change to clear all user settings

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

  newBibleWindowVersion: 'ENGWEB',
  newWindowFragmentid: 'JN1_1',
  newCommentaryWindowTextId: 'commentary:ENGWES',
  newComparisonWindowSourceVersion: 'ENGWEB',
  newComparisonWindowTargetVersion: 'ENGKJV',

  pinnedLanguage: 'English',
  pinnedLanguages: ['English', 'Spanish'],
  defaultLanguage: '',

  customCssUrl: '',

  fcbhKey: '',
  fcbhTextExclusions: [],
  fcbhLoadVersions: false,
  fcbhApiUrl: 'https://dbt.io',
  jfmKey: '',

  arclightApiKey: '52b06248a3c6e8.12980089',
  arclightApiUrl: 'https://api.arclight.org/v2',

  // DBS API
  dbsEnabled: true,
  dbsKey: '',
  dbsBase: 'https://api.dbp4.org/',
  dbsTextExclusions: [],
  dbsSearchEnabled: false,

  // DBS Audio
  dbsAudioEnabled: true,
  dbsAudioUrl: 'https://audio.dbs.org',

  // Window defaults
  enableAudioWindow: true,
  audioWindowDefaultBibleFragmentid: 'JN1_1',
  audioWindowDefaultBibleVersion: 'ENGESV',
  enableDeafBibleWindow: true,
  deafBibleWindowDefaultBibleFragmentid: 'JN1_1',
  deafBibleWindowDefaultBibleVersion: 'deaf_ASESLV',

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
    'Comic Sans': '"Comic Sans MS", cursive, sans-serif',
    'Impact': 'Impact, Charcoal, sans-serif',
    'Lucida': '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
    'Tahoma': 'Tahoma, Geneva, sans-serif',
    'Trebuchet': '"Trebuchet MS", Helvetica, sans-serif',
    'Verdana': 'Verdana, Geneva, sans-serif',
    'Courier': '"Courier New", Courier, monospace',
    'Lucida Console': '"Lucida Console", Monaco, monospace',
    'EzraSIL': 'EzraSIL, "Times New Roman", serif'
  },
  enableSettingToggles: true,
  settingToggleNames: ['Chapters', 'Verses', 'Titles', 'Notes', 'Words of Christ', 'Media', 'Justify'],
  settingToggleDefaults: [true, true, true, true, true, true, false],
  enableFeedback: false,
  feedbackUrl: '',
  windowTypesOrder: [],

  // Plugins
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
  eng2pEnableYe: true,
  eng2pEnableThee: true,
  eng2pEnableEth: true,
  eng2pEnableSt: true
};

const customConfigs = {
  dbs: {
    customCssUrl: 'dbs.css'
  }
};

const config = { ...defaultConfig };

// Dev mode: use texts_dev path when ?dev=true is in the URL
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

/**
 * Register a custom configuration preset
 * @param {string} name - Preset name
 * @param {Object} configObj - Configuration object
 */
export const registerCustomConfig = (name, configObj) => {
  customConfigs[name] = configObj;
};

/**
 * Get protocol prefix for URLs (handles file:// protocol)
 * @returns {string} Protocol prefix or empty string
 */
export const getProtocol = () => {
  if (typeof window !== 'undefined' && window?.location?.protocol === 'file:') {
    return 'https:';
  }
  return '';
};

export default config;
export { defaultConfig, customConfigs };
