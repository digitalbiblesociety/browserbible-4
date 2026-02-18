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
import { CommentaryProvider } from './CommentaryProvider.js';
import { DbsAudioTextProvider } from './DbsAudioTextProvider.js';

import {
  TextSearch,
  SearchIndexLoader,
  SearchTools
} from './Search.js';

registerTextProvider('local', LocalTextProvider);
registerTextProvider('fcbh', FCBHTextProvider);
registerTextProvider('dbs', DBSTextProvider);
registerTextProvider('commentary', CommentaryProvider);
registerTextProvider('dbs-audio', DbsAudioTextProvider);

export const texts = {
  TextLoader,
  LocalTextProvider,
  FCBHTextProvider,
  DBSTextProvider,
  CommentaryProvider,
  DbsAudioTextProvider,
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
  CommentaryProvider,
  DbsAudioTextProvider,
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
