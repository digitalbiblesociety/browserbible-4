/**
 * Audio Provider Registration
 * Imports and registers all audio providers in priority order
 */

import { registerAudioSource } from '../core/registry.js';
import { LocalAudioProvider } from './LocalAudioProvider.js';
import { DbsAudioProvider } from './DbsAudioProvider.js';

registerAudioSource(new LocalAudioProvider());
registerAudioSource(new DbsAudioProvider());
