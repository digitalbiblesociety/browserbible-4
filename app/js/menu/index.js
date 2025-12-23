/**
 * Menu Module Index
 * Registers all menu components with the registry
 */

import { registerMenuComponent } from '../core/registry.js';

// Import converted modules
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

// Base MenuComponent class
export class BaseMenuComponent {
  constructor(parentNode, menu) {
    this.parentNode = parentNode;
    this.menu = menu;
  }
}

// Register menu components
registerMenuComponent('MainMenuButton', MainMenuButton);
registerMenuComponent('MainSearchBox', MainSearchBox);
registerMenuComponent('FullScreenButton', FullScreenButton);
registerMenuComponent('AddWindowButton', AddWindowButton);
registerMenuComponent('ConfigButton', ConfigButton);
registerMenuComponent('AboutScreen', AboutScreen);
registerMenuComponent('Feedback', Feedback);
registerMenuComponent('RestoreButton', RestoreButton);
registerMenuComponent('NavigationButtons', NavigationButtons);
registerMenuComponent('FontSizeSettings', FontSizeSettings);
registerMenuComponent('FontFamilySettings', FontFamilySettings);
registerMenuComponent('ThemeSetting', ThemeSetting);
registerMenuComponent('LanguageSetting', LanguageSetting);
registerMenuComponent('ConfigToggles', ConfigToggles);
registerMenuComponent('ConfigUrl', ConfigUrl);

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
  LanguageSetting
};

export default {
  BaseMenuComponent,
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
};
