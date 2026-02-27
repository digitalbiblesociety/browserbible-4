/**
 * MainMenu - Header bar with logo and configurable menu components
 */

import { getAllMenuComponents } from '../core/registry.js';
import { elem } from '../lib/helpers.esm.js';

export class MainMenu {
  constructor(headerNode) {
    this.node = headerNode;
    this.components = [];

    this.menuContainer = elem('div', { className: 'main-menu-container' });
    this.node.appendChild(this.menuContainer);

    this._initComponents();
  }

  _initComponents() {
    const allComponents = getAllMenuComponents();

    for (const [name, ComponentClass] of allComponents) {
      try {
        const component = new ComponentClass(this.menuContainer, this);

        if (component) {
          this.components.push(component);
        }
      } catch (error) {
        console.error(`Failed to initialize menu component "${name}":`, error);
      }
    }
  }

  getComponents() {
    return this.components;
  }
}

export default MainMenu;
