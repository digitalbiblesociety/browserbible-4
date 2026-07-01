/**
 * Audio Provider Registration
 * Imports and registers all audio providers in priority order
 */

import { registerAudioSource } from '../core/registry.js';
import { LocalAudioProvider } from './LocalAudioProvider.js';
import { DbsAudioProvider } from './DbsAudioProvider.js';
import { BibleBrainAudioProvider } from './BibleBrainAudioProvider.js';

registerAudioSource(new LocalAudioProvider());
registerAudioSource(new BibleBrainAudioProvider());
registerAudioSource(new DbsAudioProvider());
