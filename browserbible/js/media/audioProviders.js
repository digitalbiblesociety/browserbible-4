/**
 * Audio Provider Registration
 * Imports and registers all audio providers in priority order
 */

import { registerAudioSource } from '../core/registry.js';
import { LocalAudioProvider } from './LocalAudioProvider.js';
import { DbsAudioProvider } from './DbsAudioProvider.js';
import { BibleBrainAudioProvider, LinkedBibleBrainAudioProvider } from './BibleBrainAudioProvider.js';

registerAudioSource(new LocalAudioProvider());
registerAudioSource(new BibleBrainAudioProvider());
registerAudioSource(new DbsAudioProvider());
// Last: Bible Brain audio for texts no earlier provider covers.
registerAudioSource(new LinkedBibleBrainAudioProvider());
