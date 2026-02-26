/**
 * CommandPalette
 * Global command palette (Ctrl/Cmd+K) for navigation and settings
 */

import { Reference } from '../bible/BibleReference.js';
import { getApp, getAllWindowTypes } from '../core/registry.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { PlaceKeeper } from '../common/PlaceKeeper.js';
import { TextNavigation } from '../common/TextNavigation.js';
import { getWindowIcon } from '../core/windowIcons.js';

const toSlug = (str) => str.replace(/\s+/g, '-').toLowerCase();

/**
 * Create command palette
 * @param {HTMLElement} _parentNode - Parent container (unused, palette appends to body)
 * @param {Object} _menu - Menu instance
 */
export function CommandPalette(_parentNode, _menu) {
  const commands = [];
  let selectedIndex = 0;
  let filteredItems = [];
  let isOpen = false;

  // ── DOM ──────────────────────────────────────────────────────────────────

  const backdrop = document.createElement('div');
  backdrop.className = 'command-palette-backdrop';

  const modal = document.createElement('div');
  modal.className = 'command-palette';

  const header = document.createElement('div');
  header.className = 'command-palette-header';

  const input = document.createElement('input');
  input.className = 'command-palette-input';
  input.type = 'text';
  input.placeholder = 'Type a command or Bible reference...';
  input.autocomplete = 'off';

  const kbd = document.createElement('kbd');
  kbd.className = 'command-palette-shortcut';
  kbd.textContent = 'Esc';

  header.append(input, kbd);

  const results = document.createElement('div');
  results.className = 'command-palette-results';

  modal.append(header, results);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // ── Open / Close ─────────────────────────────────────────────────────────

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    input.value = '';
    selectedIndex = 0;
    backdrop.classList.add('open');
    renderHelp();
    // Delay focus so the animation can start
    requestAnimationFrame(() => input.focus());
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    backdrop.classList.remove('open');
    input.value = '';
    filteredItems = [];
  };

  // ── Rendering ────────────────────────────────────────────────────────────

  const renderHelp = () => {
    results.innerHTML = '';
    const help = document.createElement('div');
    help.className = 'command-palette-help';
    help.innerHTML =
      'Type a Bible reference to navigate (e.g. <kbd>John 3</kbd>)<br>' +
      'Type <kbd>&gt;</kbd> to search commands (e.g. <kbd>&gt; theme</kbd>)';
    results.appendChild(help);
  };

  const renderItems = (items) => {
    results.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'command-palette-help';
      empty.textContent = 'No results found';
      results.appendChild(empty);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = document.createElement('div');
      row.className = 'command-palette-item' + (i === selectedIndex ? ' selected' : '');
      row.dataset.index = i;

      if (item.icon) {
        const iconEl = document.createElement('span');
        iconEl.className = 'command-palette-item-icon';
        iconEl.innerHTML = item.icon;
        row.appendChild(iconEl);
      }

      const label = document.createElement('span');
      label.className = 'command-palette-item-label';
      label.textContent = item.name;
      row.appendChild(label);

      if (item.state) {
        const state = document.createElement('span');
        state.className = 'command-palette-item-state';
        state.textContent = item.state();
        row.appendChild(state);
      }

      if (item.category) {
        const cat = document.createElement('span');
        cat.className = 'command-palette-item-category';
        cat.textContent = item.category;
        row.appendChild(cat);
      }

      results.appendChild(row);
    }
  };

  const updateSelection = (newIndex) => {
    if (filteredItems.length === 0) return;
    if (newIndex < 0) newIndex = filteredItems.length - 1;
    if (newIndex >= filteredItems.length) newIndex = 0;
    selectedIndex = newIndex;

    const rows = results.querySelectorAll('.command-palette-item');
    rows.forEach((row, i) => row.classList.toggle('selected', i === selectedIndex));

    // Scroll selected into view
    rows[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  };

  // ── Command Registration ─────────────────────────────────────────────────

  const registerCommand = (cmd) => {
    commands.push(cmd);
  };

  const registerThemeCommands = () => {
    const themeNames = ['default', 'shiloh', 'jabbok', 'gethsemane'];
    const themeLabels = { default: 'Normal', shiloh: 'Shiloh', jabbok: 'Jabbok', gethsemane: 'Gethsemane' };
    const themeKey = 'config-theme';

    for (const themeName of themeNames) {
      registerCommand({
        name: `Theme: ${themeLabels[themeName]}`,
        keywords: ['theme', 'color', 'dark', 'light', themeName],
        category: 'theme',
        execute() {
          for (const tn of themeNames) {
            document.body.classList.remove(`theme-${tn}`);
          }
          document.body.classList.add(`theme-${themeName}`);
          AppSettings.setValue(themeKey, { themeName });
          close();
        }
      });
    }
  };

  const registerToggleCommands = () => {
    const config = getConfig();
    const toggleNames = config.settingToggleNames ?? [];
    const toggleDefaults = config.settingToggleDefaults ?? [];

    for (const [i, toggleName] of toggleNames.entries()) {
      const toggleId = toggleName.replace(/\s/gi, '').toLowerCase();
      const defaultSetting = { checked: toggleDefaults[i] };

      registerCommand({
        name: `Toggle: ${toggleName}`,
        keywords: ['toggle', 'setting', toggleName.toLowerCase(), toggleId],
        category: 'toggle',
        stayOpen: true,
        state() {
          const setting = AppSettings.getValue(toggleId, defaultSetting);
          return setting.checked === true || setting.checked === 'true' ? 'ON' : 'OFF';
        },
        execute() {
          const setting = AppSettings.getValue(toggleId, defaultSetting);
          const currentlyOn = setting.checked === true || setting.checked === 'true';
          const newChecked = !currentlyOn;

          PlaceKeeper.preservePlace(() => {
            const toggle = document.querySelector(`#config-toggle-${toggleId}`);
            const onClass = `toggle-${toggleId}-on`;
            const offClass = `toggle-${toggleId}-off`;

            if (newChecked) {
              if (toggle) {
                toggle.classList.add('toggle-on');
                const inp = toggle.querySelector('input');
                if (inp) inp.checked = true;
              }
              document.body.classList.add(onClass);
              document.body.classList.remove(offClass);
            } else {
              if (toggle) {
                toggle.classList.remove('toggle-on');
                const inp = toggle.querySelector('input');
                if (inp) inp.checked = false;
              }
              document.body.classList.remove(onClass);
              document.body.classList.add(offClass);
            }
          });
          AppSettings.setValue(toggleId, { checked: newChecked });
          // Re-render to update state indicator
          renderItems(filteredItems);
        }
      });
    }
  };

  const registerWindowCommands = () => {
    const config = getConfig();
    const windowTypes = getAllWindowTypes();
    const windowTools = [];

    if (config.windowTypesOrder?.length > 0) {
      for (const windowTypeName of config.windowTypesOrder) {
        const winType = windowTypes.find(wt => wt.className === windowTypeName);
        if (winType) {
          windowTools.push({ type: winType.className, label: winType.param, data: { ...(winType.init ?? {}) } });
        }
      }
    } else {
      for (const winType of windowTypes) {
        windowTools.push({ type: winType.className, label: winType.param, data: { ...(winType.init ?? {}) } });
      }
    }

    for (const tool of windowTools) {
      const iconSvg = getWindowIcon(tool.type);
      registerCommand({
        name: `Add Window: ${tool.label.charAt(0).toUpperCase() + tool.label.slice(1)}`,
        keywords: ['window', 'add', 'open', tool.label, tool.type.toLowerCase()],
        category: 'window',
        icon: iconSvg || null,
        execute() {
          const app = getApp();
          const data = { ...tool.data };

          if (tool.type === 'BibleWindow' || tool.type === 'CommentaryWindow' || tool.type === 'AudioWindow') {
            const firstBCWindow = app?.windowManager?.getWindows().find(w => w.className === 'BibleWindow' || w.className === 'CommentaryWindow') ?? null;
            const currentData = firstBCWindow?.getData() ?? null;

            if (currentData !== null) {
              data.fragmentid = currentData.fragmentid;
              data.sectionid = currentData.sectionid;
              if (tool.type === 'AudioWindow') {
                data._activeBibleTextid = currentData.textid;
              }
            } else {
              const fragmentid = config.newWindowFragmentid ?? 'JN1_1';
              data.fragmentid = fragmentid;
              data.sectionid = fragmentid.split('_')[0];
            }
          }

          PlaceKeeper.preservePlace(() => {
            app?.windowManager?.add(tool.type, data);
          });
          close();
        }
      });
    }
  };

  const registerFontFamilyCommands = () => {
    const config = getConfig();
    const fontFamilyStacks = config.fontFamilyStacks ?? {};
    const fontFamilyStackNames = Object.keys(fontFamilyStacks);
    const fontFamilyKey = 'config-font-family';

    for (const fontStackName of fontFamilyStackNames) {
      registerCommand({
        name: `Font: ${fontStackName}`,
        keywords: ['font', 'family', 'typeface', fontStackName.toLowerCase()],
        category: 'font',
        execute() {
          PlaceKeeper.preservePlace(() => {
            for (const name of fontFamilyStackNames) {
              document.body.classList.remove(`config-font-family-${toSlug(name)}`);
            }
            document.body.classList.add(`config-font-family-${toSlug(fontStackName)}`);
            AppSettings.setValue(fontFamilyKey, { fontName: fontStackName });
          });

          // Update the radio button in settings if visible
          const radio = document.querySelector(`#config-font-family-${toSlug(fontStackName)}-value`);
          if (radio) radio.checked = true;

          close();
        }
      });
    }
  };

  const registerFontSizeCommands = () => {
    const config = getConfig();
    const fontSizeMin = config.fontSizeMin ?? 14;
    const fontSizeMax = config.fontSizeMax ?? 28;
    const fontSizeStep = config.fontSizeStep ?? 2;
    const fontSizeKey = 'config-font-size';
    const fontSizeDefault = config.fontSizeDefault ?? 18;

    const changeFontSize = (delta) => {
      const current = AppSettings.getValue(fontSizeKey, { fontSize: fontSizeDefault });
      const currentSize = parseInt(current.fontSize, 10) || fontSizeDefault;
      const newSize = Math.min(fontSizeMax, Math.max(fontSizeMin, currentSize + delta));

      PlaceKeeper.preservePlace(() => {
        for (let size = fontSizeMin; size <= fontSizeMax; size += fontSizeStep) {
          document.body.classList.remove(`config-font-size-${size}`);
        }
        document.body.classList.add(`config-font-size-${newSize}`);
        AppSettings.setValue(fontSizeKey, { fontSize: newSize });
      });

      // Update slider if visible
      const slider = document.querySelector('.settings-slider');
      if (slider) slider.value = newSize;
    };

    registerCommand({
      name: 'Font Size: Increase',
      keywords: ['font', 'size', 'bigger', 'larger', 'increase', 'zoom in'],
      category: 'font',
      execute() {
        changeFontSize(fontSizeStep);
        close();
      }
    });

    registerCommand({
      name: 'Font Size: Decrease',
      keywords: ['font', 'size', 'smaller', 'decrease', 'zoom out'],
      category: 'font',
      execute() {
        changeFontSize(-fontSizeStep);
        close();
      }
    });
  };

  const registerActionCommands = () => {
    registerCommand({
      name: 'Toggle Fullscreen',
      keywords: ['fullscreen', 'full', 'screen', 'maximize'],
      category: 'action',
      execute() {
        if (document.fullscreenEnabled) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
        }
        close();
      }
    });

    registerCommand({
      name: 'Focus Search',
      keywords: ['search', 'find', 'focus', 'input'],
      category: 'action',
      execute() {
        close();
        const searchInput = document.querySelector('#main-search-input');
        searchInput?.focus();
      }
    });

    registerCommand({
      name: 'Restore Defaults',
      keywords: ['restore', 'reset', 'defaults', 'clear'],
      category: 'action',
      execute() {
        const config = getConfig();
        if (config.windows !== undefined) {
          const querystring = [];
          for (const [i, win] of config.windows.entries()) {
            querystring.push(`win${i + 1}=${win.type}`);
            for (const key of Object.keys(win.data ?? {})) {
              querystring.push(`${key}${i + 1}=${win.data[key]}`);
            }
          }
          window.location.href = `${window.location.pathname}?${querystring.join('&')}`;
        } else {
          window.location.reload();
        }
      }
    });
  };

  // ── Filtering & Modes ────────────────────────────────────────────────────

  const filterCommands = (query) => {
    const q = query.toLowerCase();
    return commands.filter(cmd => {
      if (cmd.name.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some(kw => kw.includes(q))) return true;
      return false;
    });
  };

  const getNavigationItems = (query) => {
    const ref = new Reference(query);
    if (!ref || !ref.isValid?.()) return [];

    const textid = getCurrentVersion();
    return [{
      name: `Go to ${ref.toString()}`,
      category: 'navigate',
      icon: getWindowIcon('BibleWindow'),
      execute() {
        const app = getApp();
        const sectionid = ref.toSection();
        const bibleWindows = app?.windowManager?.getWindows()?.filter(w => w.className === 'BibleWindow') || [];

        if (bibleWindows.length > 0) {
          TextNavigation.locationChange(sectionid);
          for (const win of bibleWindows) {
            win.controller?.scroller?.load('text', sectionid);
          }
        }
        close();
      }
    }];
  };

  const getCurrentVersion = () => {
    const app = getApp();
    const config = getConfig();
    let textid = config.newBibleWindowVersion;
    const appSettings = app?.windowManager?.getSettings();
    if (appSettings) {
      for (const settings of appSettings) {
        if (settings.windowType === 'BibleWindow') {
          textid = settings.data.textid;
          break;
        }
      }
    }
    return textid;
  };

  const handleInput = () => {
    const value = input.value;

    if (!value) {
      filteredItems = [];
      selectedIndex = 0;
      renderHelp();
      return;
    }

    if (value.startsWith('>')) {
      // Command mode
      const query = value.slice(1).trim();
      filteredItems = query ? filterCommands(query) : [...commands];
    } else {
      // Navigation mode
      filteredItems = getNavigationItems(value);
    }

    selectedIndex = 0;
    renderItems(filteredItems);
  };

  const executeSelected = () => {
    if (filteredItems.length === 0) return;
    const item = filteredItems[selectedIndex];
    if (item) {
      item.execute();
      // If stayOpen, re-render after execution (state may have changed)
      // The execute function handles close() when needed
    }
  };

  // ── Events ───────────────────────────────────────────────────────────────

  input.addEventListener('input', handleInput);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelection(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelection(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    }
  });

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) {
      close();
    }
  });

  results.addEventListener('click', (e) => {
    const row = e.target.closest('.command-palette-item');
    if (row) {
      const index = parseInt(row.dataset.index, 10);
      selectedIndex = index;
      executeSelected();
    }
  });

  results.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.command-palette-item');
    if (row) {
      const index = parseInt(row.dataset.index, 10);
      updateSelection(index);
    }
  });

  // Global keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (isOpen) {
        close();
      } else {
        open();
      }
    }
  });

  // ── Initialize commands ──────────────────────────────────────────────────

  registerThemeCommands();
  registerToggleCommands();
  registerWindowCommands();
  registerFontFamilyCommands();
  registerFontSizeCommands();
  registerActionCommands();
}

export default CommandPalette;
