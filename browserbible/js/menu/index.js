/**
 * Menu Module Index
 * Imported once (`import './menu/index.js'`) purely for the side effect of
 * registering every menu component with the registry. Nothing imports its members.
 */

import { registerMenuComponent } from '../core/registry.js';
import { MainMenuButton } from './MainMenuButton.js';
import { MainSearchBox } from './MainSearchBox.js';
import { AddWindowButton } from './AddWindowButton.js';
import { FullScreenButton } from './FullScreenButton.js';
import { ConfigButton } from './ConfigButton.js';
import { NavigationButtons } from './NavigationButtons.js';
import { RestoreButton } from './RestoreButton.js';
import { AboutScreen } from './AboutScreen.js';
import { Feedback } from './Feedback.js';
import { ThemeSetting } from './ThemeSetting.js';
import { FontFamilySettings } from './FontFamilySettings.js';
import { FontSizeSettings } from './FontSizeSettings.js';
import { ConfigToggles } from './ConfigToggles.js';
import { ConfigUrl } from './ConfigUrl.js';
import { LanguageSetting } from './LanguageSetting.js';
import { ApocryphaSetting } from './ApocryphaSetting.js';
import { CommandPalette } from './CommandPalette.js';

// Register menu components
registerMenuComponent('MainMenuButton', MainMenuButton);
registerMenuComponent('NavigationButtons', NavigationButtons);
registerMenuComponent('MainSearchBox', MainSearchBox);
registerMenuComponent('FullScreenButton', FullScreenButton);
registerMenuComponent('AddWindowButton', AddWindowButton);
registerMenuComponent('ConfigButton', ConfigButton);
registerMenuComponent('AboutScreen', AboutScreen);
registerMenuComponent('Feedback', Feedback);
registerMenuComponent('RestoreButton', RestoreButton);
registerMenuComponent('FontSizeSettings', FontSizeSettings);
registerMenuComponent('FontFamilySettings', FontFamilySettings);
registerMenuComponent('ThemeSetting', ThemeSetting);
registerMenuComponent('LanguageSetting', LanguageSetting);
registerMenuComponent('ApocryphaSetting', ApocryphaSetting);
registerMenuComponent('ConfigToggles', ConfigToggles);
registerMenuComponent('ConfigUrl', ConfigUrl);
registerMenuComponent('CommandPalette', CommandPalette);
