/**
 * Registry
 * Central registration system for plugins, window types, providers, and globals
 */

const plugins = new Map();
const windowTypes = new Map();
const menuComponents = new Map();
const textProviders = new Map();
const audioSources = [];

export const VERSION = '5.0.0';

// ─── Plugins ────────────────────────────────────────────────────────────────

/**
 * Register a plugin factory function
 * @param {string} name - Plugin identifier
 * @param {Function} PluginClass - Factory function that creates plugin instances
 */
export const registerPlugin = (name, PluginClass) => {
  plugins.set(name, PluginClass);
};

/** @returns {Array<[string, Function]>} All registered plugins */
export const getAllPlugins = () => Array.from(plugins.entries());

// ─── Window Types ───────────────────────────────────────────────────────────

/**
 * Register a window type
 * @param {Object} config - Window type configuration
 * @param {string} config.param - URL parameter name (e.g., 'bible')
 * @param {string} config.className - CSS class name (e.g., 'BibleWindow')
 * @param {Function} config.WindowClass - Factory function or web component class
 * @param {string} config.displayName - Human-readable name
 * @param {Object} [config.paramKeys] - URL param key mappings
 */
export const registerWindowType = (config) => {
  const { param, className, WindowClass, displayName, paramKeys = {}, init } = config;
  windowTypes.set(param, {
    param,
    className,
    WindowClass,
    displayName,
    paramKeys,
    init
  });
};

/** @param {string} param - URL parameter name */
export const getWindowType = (param) => windowTypes.get(param);

/** @param {string} className - CSS class name */
export const getWindowTypeByClassName = (className) => {
  for (const [, wt] of windowTypes) {
    if (wt.className === className) {
      return wt;
    }
  }
  return null;
};

/** @returns {Array<Object>} All registered window types */
export const getAllWindowTypes = () => Array.from(windowTypes.values());

// ─── Menu Components ────────────────────────────────────────────────────────

/**
 * Register a menu component
 * @param {string} name - Component name
 * @param {Function} ComponentClass - Component factory or class
 */
export const registerMenuComponent = (name, ComponentClass) => {
  menuComponents.set(name, ComponentClass);
};

export const getAllMenuComponents = () => Array.from(menuComponents.entries());

// ─── Text Providers ─────────────────────────────────────────────────────────

/**
 * Register a text content provider
 * @param {string} name - Provider name (e.g., 'local', 'dbs')
 * @param {Object} provider - Provider implementation
 */
export const registerTextProvider = (name, provider) => {
  textProviders.set(name, provider);
};

export const getTextProvider = (name) => textProviders.get(name);

// ─── Audio Sources ──────────────────────────────────────────────────────────

/** @param {Object} source - Audio source configuration */
export const registerAudioSource = (source) => {
  audioSources.push(source);
};

export const getAudioSources = () => audioSources;

// ─── App Instance ───────────────────────────────────────────────────────────

let appInstance = null;

/** @param {App} app - Application instance */
export const setApp = (app) => {
  appInstance = app;
};

/** @returns {App|null} */
export const getApp = () => appInstance;

const registry = {
  VERSION,
  registerPlugin,
  getAllPlugins,
  registerWindowType,
  getWindowType,
  getWindowTypeByClassName,
  getAllWindowTypes,
  registerMenuComponent,
  getAllMenuComponents,
  registerTextProvider,
  getTextProvider,
  registerAudioSource,
  getAudioSources,
  setApp,
  getApp
};

export default registry;
