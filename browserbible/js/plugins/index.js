/**
 * Plugins Module Index
 * Imported once (`import './plugins/index.js'`) purely for the side effect of
 * registering every plugin with the registry. Nothing imports its members.
 */

import { registerPlugin } from '../core/registry.js';

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
