/**
 * Application Configuration
 * Central configuration management
 */


const defaultConfig = {
  // Change this to clear all user settings
  settingsPrefix: '20140307',

  enableOnlineSources: true,

  windows: [
    { type: 'bible', data: { textid: 'ENGWEB', fragmentid: 'JN1_1' } },
    { type: 'bible', data: { textid: 'ENGASV', fragmentid: 'JN1_1' } }
  ],

  baseContentUrl: 'https://inscript.bible.cloud/',
  baseContentApiPath: '',
  baseContentApiKey: '',
  textsIndexPath: 'texts.json',
  aboutPagePath: 'about.html',
  serverSearchPath: 'https://arc.dbs.org/api/bible-search/',
  topTexts: [],

  newBibleWindowVersion: 'ENGWEB',
  newWindowFragmentid: 'JN1_1',
  newCommentaryWindowTextId: 'comm_eng_wesley',
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

  // DBS Text Provider
  dbsEnabled: true,
  dbsKey: '',
  dbsBase: 'https://api.dbp4.org/',
  dbsTextExclusions: [],
  dbsSearchEnabled: false,

  // Window Defaults
  enableAudioWindow: true,
  audioWindowDefaultBibleFragmentid: 'JN1_1',
  audioWindowDefaultBibleVersion: 'ENGESV',
  enableDeafBibleWindow: true,
  deafBibleWindowDefaultBibleFragmentid: 'JN1_1',
  deafBibleWindowDefaultBibleVersion: 'deaf_ASESLV',

  // Menu Components
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

let config = { ...defaultConfig };

export const getConfig = () => config;

export const updateConfig = (newConfig) => {
  config = Object.assign({}, config, newConfig);
  return config;
};

export const getCustomConfig = (name) => customConfigs[name] ?? null;

export const registerCustomConfig = (name, configObj) => {
  customConfigs[name] = configObj;
};

export const getProtocol = () => {
  if (typeof window !== 'undefined' && window?.location?.protocol === 'file:') {
    return 'https:';
  }
  return '';
};

export default config;
export { defaultConfig, customConfigs };
