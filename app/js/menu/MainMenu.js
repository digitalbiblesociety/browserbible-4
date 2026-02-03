/**
 * MainMenu
 * Main application menu
 */

import { getAllMenuComponents } from '../core/registry.js';

export class MainMenu {
  constructor(headerNode) {
    this.node = headerNode;
    this.components = [];

    // Create logo
    const logo = Object.assign(document.createElement('div'), { id: 'app-logo' });
    this.node.appendChild(logo);

    // Create menu container
    this.menuContainer = Object.assign(document.createElement('div'), { className: 'main-menu-container' });
    this.node.appendChild(this.menuContainer);

    // Initialize all registered menu components
    this._initComponents();
  }

  _initComponents() {
    const allComponents = getAllMenuComponents();

    for (const [name, ComponentClass] of allComponents) {
      try {
        // Support both class constructors and factory functions
        const isClass = ComponentClass.prototype && ComponentClass.prototype.constructor === ComponentClass;
        let component;
        if (isClass) {
          component = new ComponentClass(this.menuContainer, this);
        } else {
          component = ComponentClass(this.menuContainer, this);
        }

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
