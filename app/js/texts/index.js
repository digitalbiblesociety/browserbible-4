/**
 * Texts Module Index
 * Exports text loading and search functionality
 */

import {
  TextLoader,
  registerTextProvider,
  getTextProvider,
  getTextProviders,
  loadSection,
  loadTexts,
  loadTextsManifest,
  getText,
  getTextid,
  getProviderName,
  getProviderId,
  getTextInfoData,
  getTextData,
  startSearch,
  processText,
  processTexts
} from './TextLoader.js';

import { LocalTextProvider } from './LocalTextProvider.js';
import { FCBHTextProvider } from './FCBHTextProvider.js';
import { DBSTextProvider } from './DBSTextProvider.js';

import {
  TextSearch,
  SearchIndexLoader,
  SearchTools
} from './Search.js';

registerTextProvider('local', LocalTextProvider);
registerTextProvider('fcbh', FCBHTextProvider);
registerTextProvider('dbs', DBSTextProvider);

export const texts = {
  TextLoader,
  LocalTextProvider,
  FCBHTextProvider,
  DBSTextProvider,
  TextSearch,
  SearchIndexLoader,
  SearchTools,
  registerTextProvider,
  getTextProvider,
  getTextProviders,
  loadSection,
  loadTexts,
  loadTextsManifest,
  getText,
  getTextid,
  getProviderName,
  getProviderId,
  getTextInfoData,
  getTextData,
  startSearch,
  processText,
  processTexts
};

export {
  TextLoader,
  LocalTextProvider,
  FCBHTextProvider,
  DBSTextProvider,
  TextSearch,
  SearchIndexLoader,
  SearchTools,
  registerTextProvider,
  getTextProvider,
  getTextProviders,
  loadSection,
  loadTexts,
  loadTextsManifest,
  getText,
  getTextid,
  getProviderName,
  getProviderId,
  getTextInfoData,
  getTextData,
  startSearch,
  processText,
  processTexts
};

export default texts;
