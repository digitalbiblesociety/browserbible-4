/**
 * Registry
 * Replaces the global sofia namespace pattern with a module-based registry
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

export const VERSION = '4.0.0';

export const registerPlugin = (name, PluginClass) => {
  plugins.set(name, PluginClass);
};

export const getPlugin = (name) => plugins.get(name);

export const getAllPlugins = () => Array.from(plugins.entries());

export const getPluginInstances = () => pluginInstances;

export const addPluginInstance = (instance) => {
  pluginInstances.push(instance);
};

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

export const getWindowType = (param) => windowTypes.get(param);

export const getWindowTypeByClassName = (className) => {
  for (const [, wt] of windowTypes) {
    if (wt.className === className) {
      return wt;
    }
  }
  return null;
};

export const getAllWindowTypes = () => Array.from(windowTypes.values());

export const registerMenuComponent = (name, ComponentClass) => {
  menuComponents.set(name, ComponentClass);
};

export const getMenuComponent = (name) => menuComponents.get(name);

export const getAllMenuComponents = () => Array.from(menuComponents.entries());

export const registerTextProvider = (name, provider) => {
  textProviders.set(name, provider);
};

export const getTextProvider = (name) => textProviders.get(name);

export const getAllTextProviders = () => Array.from(textProviders.entries());

export const registerAudioSource = (source) => {
  audioSources.push(source);
};

export const getAudioSources = () => audioSources;

export const registerInitMethod = (fn) => {
  initMethods.push(fn);
};

export const runInitMethods = () => {
  for (const fn of initMethods) {
    fn();
  }
};

export const getInitMethods = () => initMethods;

export const setGlobal = (key, value) => {
  globals[key] = value;
};

export const getGlobal = (key) => globals[key];

export const getGlobals = () => globals;

export const registerResource = (lang, translations) => {
  resources[lang] = translations;
};

export const getResource = (lang) => resources[lang];

export const getAllResources = () => resources;

let appInstance = null;

export const setApp = (app) => {
  appInstance = app;
};

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
