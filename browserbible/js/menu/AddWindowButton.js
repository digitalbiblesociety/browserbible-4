import { getConfig } from '../core/config.js';
import { getAllWindowTypes, getApp } from '../core/registry.js';
import { PlaceKeeper } from '../common/PlaceKeeper.js';
import { getWindowIcon } from '../core/windowIcons.js';
import { elem } from '../lib/helpers.esm.js';

/**
 * Create "add window" buttons in the main menu, one per enabled window type.
 * @returns {HTMLElement} The last button created (menu-component convention)
 */
export function AddWindowButton() {
  const config = getConfig();
  const buttonMenu = document.querySelector('#main-menu-windows-list');
  const windowTypes = getAllWindowTypes();
  const disabled = new Set(config.disabledWindowTypes ?? []);
  const buttonData = new WeakMap();

  const order = config.windowTypesOrder;
  const orderedTypes = order?.length
    ? order.map(name => windowTypes.find(wt => wt.className === name)).filter(Boolean)
    : windowTypes;

  let addButton;
  for (const wt of orderedTypes) {
    if (disabled.has(wt.className)) continue;

    const iconSvg = getWindowIcon(wt.className);
    addButton = elem('div', { className: 'main-menu-item window-add', id: `add-${wt.className}` },
      iconSvg ? elem('span', { className: 'main-menu-icon', innerHTML: iconSvg }) : null,
      elem('span', { className: 'i18n', dataset: { i18n: `[html]windows.${wt.param}.label` } })
    );

    buttonMenu?.appendChild(addButton);
    buttonData.set(addButton, { type: wt.className, data: wt.init ?? {} });
  }

  buttonMenu?.addEventListener('click', (e) => {
    const button = e.target.closest('.window-add');
    const settings = button && buttonData.get(button);
    if (!settings) return;

    const app = getApp();

    // when starting a bible, commentary, or audio window, try to match it up with the others
    if (settings.type === 'BibleWindow' || settings.type === 'CommentaryWindow' || settings.type === 'AudioWindow') {
      const firstBCWindow = app?.windowManager?.getWindows()
        .find(w => w.className === 'BibleWindow' || w.className === 'CommentaryWindow') ?? null;
      const currentData = firstBCWindow?.getData() ?? null;

      if (currentData !== null) {
        settings.data.fragmentid = currentData.fragmentid;
        settings.data.sectionid = currentData.sectionid;
        if (settings.type === 'AudioWindow') {
          settings.data._activeBibleTextid = currentData.textid;
        }
      } else {
        const fragmentid = config.newWindowFragmentid ?? 'JN1_1';
        settings.data.fragmentid = fragmentid;
        settings.data.sectionid = fragmentid.split('_')[0];
      }
    }

    PlaceKeeper.preservePlace(() => {
      app?.windowManager?.add(settings.type, settings.data);
    });
  });

  return addButton;
}
