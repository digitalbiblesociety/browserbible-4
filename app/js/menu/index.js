/**
 * Menu Module Index
 * Registers all menu components with the registry
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
import { MainMenu } from './MainMenu.js';
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
registerMenuComponent('ConfigToggles', ConfigToggles);
registerMenuComponent('ConfigUrl', ConfigUrl);
registerMenuComponent('CommandPalette', CommandPalette);

// Re-export everything
export {
  MainMenu,
  MainMenuButton,
  MainSearchBox,
  AddWindowButton,
  FullScreenButton,
  ConfigButton,
  NavigationButtons,
  RestoreButton,
  AboutScreen,
  Feedback,
  ThemeSetting,
  FontFamilySettings,
  FontSizeSettings,
  ConfigToggles,
  ConfigUrl,
  LanguageSetting,
  CommandPalette
};

export default {
  MainMenu,
  MainMenuButton,
  MainSearchBox,
  FullScreenButton,
  AddWindowButton,
  ConfigButton,
  AboutScreen,
  Feedback,
  RestoreButton,
  NavigationButtons,
  FontSizeSettings,
  FontFamilySettings,
  ThemeSetting,
  LanguageSetting,
  ConfigToggles,
  ConfigUrl,
  CommandPalette,
};
