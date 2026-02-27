import { MovableWindow } from './MovableWindow.js';
import { InfoWindow } from './InfoWindow.js';
import { TextChooser, getGlobalTextChooser } from './TextChooser.js';
import { TextNavigator, getGlobalTextNavigator } from './TextNavigator.js';

export const ui = {
  MovableWindow,
  InfoWindow,
  TextChooser,
  TextNavigator,
  getGlobalTextChooser,
  getGlobalTextNavigator
};

export {
  MovableWindow,
  InfoWindow,
  TextChooser,
  TextNavigator,
  getGlobalTextChooser,
  getGlobalTextNavigator
};

// Make MovableWindow available globally (some code may reference it directly)
if (typeof window !== 'undefined') {
  window.MovableWindow = MovableWindow;
}

export default ui;
