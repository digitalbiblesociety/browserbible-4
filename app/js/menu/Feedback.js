/**
 * Feedback
 * Feedback form dialog
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import feedbackSvg from '../../css/images/feedback.svg?raw';

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

  const feedbackButton = elem('div', { className: 'main-menu-item feedback-logo' });
  const feedbackIconSpan = elem('span', { className: 'main-menu-icon' });
  feedbackIconSpan.innerHTML = feedbackSvg;
  feedbackButton.appendChild(feedbackIconSpan);
  const feedbackTextSpan = elem('span', { className: 'i18n' });
  feedbackTextSpan.dataset.i18n = '[html]menu.labels.feedback';
  feedbackButton.appendChild(feedbackTextSpan);
  const mainMenuFeatures = document.querySelector('#main-menu-features');
  const modalOverlay = elem('div', { className: 'modal-overlay', style: { display: 'none' } });
  const feedbackWindow = new MovableWindow(Math.min(window.innerWidth, 500), 300, i18n.t('menu.labels.feedback'));

  mainMenuFeatures?.appendChild(feedbackButton);

  document.body.appendChild(modalOverlay);

  const feedbackBody = feedbackWindow.body;

  const name = elem('input', { type: 'text', id: 'feedback-from', className: 'app-input i18n', dataset: { i18n: '[placeholder]menu.feedback.name' } });
  feedbackBody.appendChild(name);

  const email = elem('input', { type: 'email', id: 'feedback-email', className: 'app-input i18n', dataset: { i18n: '[placeholder]menu.feedback.email' } });
  feedbackBody.appendChild(email);

  const subject = elem('select', { id: 'feedback-subject', className: 'app-list' },
    elem('option', { className: 'i18n', dataset: { i18n: '[html]menu.feedback.feature' } }),
    elem('option', { className: 'i18n', dataset: { i18n: '[html]menu.feedback.bug' } }),
    elem('option', { className: 'i18n', dataset: { i18n: '[html]menu.feedback.other' } })
  );
  feedbackBody.appendChild(subject);

  const comments = elem('textarea', { id: 'feedback-comment', className: 'app-input i18n', dataset: { i18n: '[placeholder]menu.feedback.comments' } });
  feedbackBody.appendChild(comments);

  const send = elem('input', { type: 'button', id: 'feedback-submit', className: 'app-button i18n', dataset: { i18n: '[value]menu.feedback.send' } });
  feedbackBody.appendChild(send);

  const message = elem('div', { className: 'feedback-message i18n', style: { display: 'none' }, dataset: { i18n: '[placeholder]menu.feedback.thankyou' } });
  feedbackBody.appendChild(message);

  feedbackBody.classList.add('feedback-body');
  const feedbackTitle = feedbackWindow.title;
  feedbackTitle.classList.add('i18n');
  feedbackTitle.setAttribute('data-i18n', '[html]menu.labels.feedback');

  // Define helper functions before they are used
  const hideFeedback = () => {
    feedbackWindow.hide();
    modalOverlay.style.display = 'none';
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
    const feedbackContainer = feedbackWindow.container;
    if (feedbackContainer.style.display !== 'none' && feedbackContainer.offsetParent !== null) {
      hideFeedback();
    } else {
      feedbackWindow.show();
      feedbackWindow.size(Math.min(500, window.innerWidth - 40), 300);

      message.style.display = 'none';
      feedbackBody.querySelectorAll('input,textarea,select').forEach(el => {
        el.style.display = '';
      });

      const mainMenuDropdown = document.querySelector('#main-menu-dropdown');
      if (mainMenuDropdown) mainMenuDropdown.style.display = 'none';

      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      modalOverlay.style.width = `${winWidth}px`;
      modalOverlay.style.height = `${winHeight}px`;
      modalOverlay.style.display = '';
    }
  };

  modalOverlay.addEventListener('click', () => {
    hideFeedback();
  }, false);

  const closeBtn = feedbackWindow.closeButton;
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
