/**
 * Plugins Module Index
 * Registers all plugins with the registry
 */

import { registerPlugin } from '../core/registry.js';

// Import converted plugins
import { VerseMatchPlugin } from './VerseMatchPlugin.js';
import { LemmaMatchPlugin } from './LemmaMatchPlugin.js';
import { LemmaInfoPlugin } from './LemmaInfoPlugin.js';
import { LemmaPopupPlugin } from './LemmaPopupPlugin.js';
import { VisualFilters } from './VisualFilters.js';
import { CrossReferencePopupPlugin } from './CrossReferencePopupPlugin.js';
import { NotesPopupPlugin } from './NotesPopupPlugin.js';
import { MediaLibraryPlugin } from './MediaLibraryPlugin.js';
import { Eng2pPlugin } from './Eng2pPlugin.js';
import { HighlighterPlugin } from './HighlighterPlugin.js';

// Register plugins
registerPlugin('VerseMatchPlugin', VerseMatchPlugin);
registerPlugin('LemmaMatchPlugin', LemmaMatchPlugin);
registerPlugin('LemmaInfoPlugin', LemmaInfoPlugin);
registerPlugin('LemmaPopupPlugin', LemmaPopupPlugin);
registerPlugin('VisualFilters', VisualFilters);
registerPlugin('CrossReferencePopupPlugin', CrossReferencePopupPlugin);
registerPlugin('NotesPopupPlugin', NotesPopupPlugin);
registerPlugin('MediaLibraryPlugin', MediaLibraryPlugin);
registerPlugin('Eng2pPlugin', Eng2pPlugin);
registerPlugin('HighlighterPlugin', HighlighterPlugin);

// Re-export all plugins
export {
  VerseMatchPlugin,
  LemmaMatchPlugin,
  LemmaInfoPlugin,
  LemmaPopupPlugin,
  VisualFilters,
  CrossReferencePopupPlugin,
  NotesPopupPlugin,
  MediaLibraryPlugin,
  Eng2pPlugin,
  HighlighterPlugin
};

export default {
  VerseMatchPlugin,
  LemmaMatchPlugin,
  LemmaInfoPlugin,
  LemmaPopupPlugin,
  VisualFilters,
  CrossReferencePopupPlugin,
  NotesPopupPlugin,
  MediaLibraryPlugin,
  Eng2pPlugin,
  HighlighterPlugin
};
