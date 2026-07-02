import { elem } from '../../lib/helpers.esm.js';
import { InfoWindow } from '../../ui/InfoWindow.js';
import { t } from '../../lib/i18n.js';

/** Show a centered notice popup (non-blocking alert replacement). */
export function showNotice(message) {
  const notice = InfoWindow();
  notice.body.textContent = message;
  notice.on('hide', () => notice.destroy());
  notice.show().center();
}

/**
 * Non-blocking window.confirm replacement built on InfoWindow.
 * Resolves true on confirm; false on cancel, close, Escape, or click-off.
 * @param {{confirmLabel?: string, cancelLabel?: string}} [options]
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, { confirmLabel, cancelLabel } = {}) {
  return new Promise((resolve) => {
    const dialog = InfoWindow();
    let settled = false;
    const settle = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const confirmBtn = elem('button', {
      className: 'notes-confirm-btn notes-confirm-ok',
      textContent: confirmLabel || t('windows.notes.confirmOk')
    });
    const cancelBtn = elem('button', {
      className: 'notes-confirm-btn notes-confirm-cancel',
      textContent: cancelLabel || t('windows.notes.confirmCancel')
    });

    dialog.body.appendChild(
      elem('div', { className: 'notes-confirm' },
        elem('p', { className: 'notes-confirm-message', textContent: message }),
        elem('div', { className: 'notes-confirm-actions' }, cancelBtn, confirmBtn)
      )
    );

    confirmBtn.addEventListener('click', () => {
      settle(true);
      dialog.hide();
    });
    cancelBtn.addEventListener('click', () => dialog.hide());
    // Covers cancel, the close button, Escape, and popover light-dismiss
    dialog.on('hide', () => {
      settle(false);
      dialog.destroy();
    });

    dialog.show().center();
    confirmBtn.focus();
  });
}
