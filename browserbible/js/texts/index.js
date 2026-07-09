/**
 * Texts Module Index
 * Imported once (`import './texts/index.js'`) purely for the side effect of
 * registering every text provider with the registry. Nothing imports its members.
 */

import { registerTextProvider } from './TextLoader.js';
import { LocalTextProvider } from './LocalTextProvider.js';
import { BibleBrainTextProvider } from './BibleBrainTextProvider.js';
import { ApiBibleTextProvider } from './ApiBibleTextProvider.js';
import { CommentaryProvider } from './CommentaryProvider.js';
import { DbsAudioTextProvider } from './DbsAudioTextProvider.js';
import { DeafBibleTextProvider } from './DeafBibleTextProvider.js';
import { BibleBrainLinkedAudioTextProvider } from './BibleBrainLinkedAudioTextProvider.js';

registerTextProvider('local', LocalTextProvider);
registerTextProvider('biblebrain', BibleBrainTextProvider);
registerTextProvider('apibible', ApiBibleTextProvider);
registerTextProvider('commentary', CommentaryProvider);
registerTextProvider('dbs-audio', DbsAudioTextProvider);
registerTextProvider('deafbible', DeafBibleTextProvider);
// Last: flags existing texts that have re-associated Bible Brain audio.
registerTextProvider('biblebrain-linked-audio', BibleBrainLinkedAudioTextProvider);
