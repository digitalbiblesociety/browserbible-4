/**
 * Registry
 * Central registration system for plugins, window types, providers, and globals
 */

const plugins = new Map();
const pluginInstances = [];
const windowTypes = new Map();
const menuComponents = new Map();
const textProviders = new Map();
const audioSources = [];
const initMethods = [];
const globals = {};
const resources = {};

/** @type {string} Application version */
export const VERSION = '4.0.0';

// ─── Plugins ────────────────────────────────────────────────────────────────

/**
 * Register a plugin factory function
 * @param {string} name - Plugin identifier
 * @param {Function} PluginClass - Factory function that creates plugin instances
 */
export const registerPlugin = (name, PluginClass) => {
  plugins.set(name, PluginClass);
};

/** @param {string} name */
export const getPlugin = (name) => plugins.get(name);

/** @returns {Array<[string, Function]>} All registered plugins */
export const getAllPlugins = () => Array.from(plugins.entries());

/** @returns {Array} All instantiated plugin instances */
export const getPluginInstances = () => pluginInstances;

/** @param {Object} instance - Plugin instance to track */
export const addPluginInstance = (instance) => {
  pluginInstances.push(instance);
};

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
  const { param, className, WindowClass, displayName, paramKeys = {} } = config;
  windowTypes.set(param, {
    param,
    className,
    WindowClass,
    displayName,
    paramKeys
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

export const getMenuComponent = (name) => menuComponents.get(name);
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
export const getAllTextProviders = () => Array.from(textProviders.entries());

// ─── Audio Sources ──────────────────────────────────────────────────────────

/** @param {Object} source - Audio source configuration */
export const registerAudioSource = (source) => {
  audioSources.push(source);
};

export const getAudioSources = () => audioSources;

// ─── Init Methods ───────────────────────────────────────────────────────────

/** @param {Function} fn - Function to run during initialization */
export const registerInitMethod = (fn) => {
  initMethods.push(fn);
};

export const runInitMethods = () => {
  for (const fn of initMethods) {
    fn();
  }
};

export const getInitMethods = () => initMethods;

// ─── Globals ────────────────────────────────────────────────────────────────

/**
 * Set a global value (replaces window.sofia.globals pattern)
 * @param {string} key
 * @param {*} value
 */
export const setGlobal = (key, value) => {
  globals[key] = value;
};

export const getGlobal = (key) => globals[key];
export const getGlobals = () => globals;

// ─── Resources ──────────────────────────────────────────────────────────────

/**
 * Register language resources for i18n
 * @param {string} lang - Language code
 * @param {Object} translations - Translation object
 */
export const registerResource = (lang, translations) => {
  resources[lang] = translations;
};

export const getResource = (lang) => resources[lang];
export const getAllResources = () => resources;

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
  getPlugin,
  getAllPlugins,
  getPluginInstances,
  addPluginInstance,
  registerWindowType,
  getWindowType,
  getWindowTypeByClassName,
  getAllWindowTypes,
  registerMenuComponent,
  getMenuComponent,
  getAllMenuComponents,
  registerTextProvider,
  getTextProvider,
  getAllTextProviders,
  registerAudioSource,
  getAudioSources,
  registerInitMethod,
  runInitMethods,
  getInitMethods,
  setGlobal,
  getGlobal,
  getGlobals,
  registerResource,
  getResource,
  getAllResources,
  setApp,
  getApp
};

export default registry;
