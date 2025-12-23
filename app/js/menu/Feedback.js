/**
 * Feedback
 * Feedback form dialog
 */

import { createElements, qs, toElement } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';

// Default config
updateConfig({
  enableFeedback: false,
  feedbackUrl: ''
});

/**
 * Create feedback button and dialog
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement|void} Button element
 */
export function Feedback(_parentNode, _menu) {
  const config = getConfig();

  if (!config.enableFeedback || config.feedbackUrl === '') {
    return;
  }

  const container = qs('.windows-container');
  const feedbackButton = createElements('<div class="main-menu-item feedback-logo i18n" data-i18n="[html]menu.labels.feedback">Feedback</div>');
  const mainMenuFeatures = qs('#main-menu-features');
  const modalOverlay = createElements('<div class="modal-overlay"></div>');
  const feedbackWindow = new MovableWindow(Math.min(window.innerWidth, 500), 300, i18n.t('menu.labels.feedback'));

  mainMenuFeatures?.appendChild(feedbackButton);

  document.body.appendChild(modalOverlay);
  modalOverlay.style.display = 'none';

  const feedbackBody = toElement(feedbackWindow.body);

  const name = createElements('<input type="text" id="feedback-from" class="app-input i18n" data-i18n="[placeholder]menu.feedback.name" />');
  feedbackBody.appendChild(name);

  const email = createElements('<input type="email" id="feedback-email" class="app-input i18n" data-i18n="[placeholder]menu.feedback.email" />');
  feedbackBody.appendChild(email);

  const subject = createElements(`<select id="feedback-subject" class="app-list">
    <option class="i18n" data-i18n="[html]menu.feedback.feature"></option>
    <option class="i18n" data-i18n="[html]menu.feedback.bug"></option>
    <option class="i18n" data-i18n="[html]menu.feedback.other"></option>
    </select>`);
  feedbackBody.appendChild(subject);

  const comments = createElements('<textarea id="feedback-comment" class="app-input i18n" data-i18n="[placeholder]menu.feedback.comments"></textarea>');
  feedbackBody.appendChild(comments);

  const send = createElements('<input type="button" id="feedback-submit" class="app-button i18n" data-i18n="[value]menu.feedback.send" />');
  feedbackBody.appendChild(send);

  const message = createElements('<div class="feedback-message i18n" data-i18n="[placeholder]menu.feedback.thankyou"></div>');
  feedbackBody.appendChild(message);
  message.style.display = 'none';

  feedbackBody.classList.add('feedback-body');
  const feedbackTitle = toElement(feedbackWindow.title);
  feedbackTitle.classList.add('i18n');
  feedbackTitle.setAttribute('data-i18n', '[html]menu.labels.feedback');

  // Define helper functions before they are used
  const hideFeedback = () => {
    feedbackWindow.hide();
    modalOverlay.style.display = 'none';
    container?.classList.remove('blur');
  };

  const validateForm = () => {
    let valid = true;

    if (name.value === '') {
      name.classList.add('invalid');
      valid = false;
    } else {
      name.classList.remove('invalid');
    }

    if (email.value === '' || !email.value.match(/.+@.+\..+/gi)) {
      email.classList.add('invalid');
      valid = false;
    } else {
      email.classList.remove('invalid');
    }

    if (comments.value === '') {
      comments.classList.add('invalid');
      valid = false;
    } else {
      comments.classList.remove('invalid');
    }

    return valid;
  };

  const clickFeedback = () => {
    const feedbackContainer = toElement(feedbackWindow.container);
    if (feedbackContainer.style.display !== 'none' && feedbackContainer.offsetParent !== null) {
      hideFeedback();
    } else {
      feedbackWindow.show();
      feedbackWindow.size(Math.min(500, window.innerWidth - 40), 300);
      feedbackWindow.center();

      message.style.display = 'none';
      feedbackBody.querySelectorAll('input,textarea,select').forEach(el => {
        el.style.display = '';
      });

      const mainMenuDropdown = qs('#main-menu-dropdown');
      if (mainMenuDropdown) mainMenuDropdown.style.display = 'none';

      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      container?.classList.add('blur');
      modalOverlay.style.width = `${winWidth}px`;
      modalOverlay.style.height = `${winHeight}px`;
      modalOverlay.style.display = '';
    }
  };

  modalOverlay.addEventListener('click', () => {
    hideFeedback();
  }, false);

  const closeBtn = toElement(feedbackWindow.closeButton);
  closeBtn.addEventListener('click', () => {
    hideFeedback();
  }, false);

  feedbackButton.addEventListener('click', clickFeedback, false);

  // OPERATE FEEDBACK
  send.addEventListener('click', async () => {
    if (validateForm()) {
      const feedbackData = {
        name: name.value,
        email: email.value,
        subject: subject.value,
        comments: comments.value
      };

      try {
        const url = `${config.baseContentUrl}${config.feedbackUrl}`;
        const params = new URLSearchParams(feedbackData).toString();

        await fetch(`${url}?${params}`, {
          method: 'GET',
          mode: 'cors'
        });

        message.style.display = '';
        feedbackBody.querySelectorAll('input,textarea,select').forEach(el => {
          el.style.display = 'none';
        });

        setTimeout(() => {
          hideFeedback();
        }, 500);
      } catch (error) {
        console.error('Feedback error:', error);
      }
    }
  }, false);

  return feedbackButton;
}

export default Feedback;
