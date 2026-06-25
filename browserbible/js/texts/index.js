/**
 * Texts Module Index
 * Imported once (`import './texts/index.js'`) purely for the side effect of
 * registering every text provider with the registry. Nothing imports its members.
 */

import { registerTextProvider } from './TextLoader.js';
import { LocalTextProvider } from './LocalTextProvider.js';
import { FCBHTextProvider } from './FCBHTextProvider.js';
import { DBSTextProvider } from './DBSTextProvider.js';
import { CommentaryProvider } from './CommentaryProvider.js';
import { DbsAudioTextProvider } from './DbsAudioTextProvider.js';

registerTextProvider('local', LocalTextProvider);
registerTextProvider('fcbh', FCBHTextProvider);
registerTextProvider('dbs', DBSTextProvider);
registerTextProvider('commentary', CommentaryProvider);
registerTextProvider('dbs-audio', DbsAudioTextProvider);
