/**
 * Application Configuration
 * Central configuration management
 */

import { extend } from '../lib/helpers.esm.js';

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
  fcbhTextExclusions: [''],
  fcbhLoadVersions: false,
  jfmKey: '',

  arclightApiKey: '52b06248a3c6e8.12980089',
  arclightApiUrl: 'https://api.arclight.org/v2'
};

const customConfigs = {
  dbs: {
    customCssUrl: 'dbs.css'
  }
};

let config = { ...defaultConfig };

export const getConfig = () => config;

export const updateConfig = (newConfig) => {
  config = extend({}, config, newConfig);
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
