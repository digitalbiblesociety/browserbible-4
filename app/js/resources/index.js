/**
 * Resource Imports (i18n translations)
 * Loads all language resource files
 */

import { registerResource } from '../core/registry.js';

// English (default)
import en from './en.esm.js';
registerResource('en', en);

// Note: Additional languages will be registered here as they are converted
// For now, we'll create stub imports that will be populated later

// Example of how other languages will be imported:
// import fr from './fr.esm.js';
// registerResource('fr', fr);
// import de from './de.esm.js';
// registerResource('de', de);
// etc.
