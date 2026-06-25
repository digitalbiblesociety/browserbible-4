import { MovableWindow } from './MovableWindow.js';

// Imported once for this side effect: LocalTextProvider references window.MovableWindow
// directly for its "Texts Error" modal. Nothing imports this module's members.
if (typeof window !== 'undefined') {
  window.MovableWindow = MovableWindow;
}
