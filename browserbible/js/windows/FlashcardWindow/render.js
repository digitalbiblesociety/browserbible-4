/**
 * FlashcardWindow Render Functions
 * UI rendering using elem helper
 */

import { elem } from '../../lib/helpers.esm.js';

/**
 * Format a relative date for next review
 */
export function formatNextReview(timestamp) {
  if (!timestamp) return 'New';
  const now = Date.now();
  const diff = timestamp - now;

  if (diff <= 0) return 'Due now';

  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.ceil(days / 7)} weeks`;
  return `${Math.ceil(days / 30)} months`;
}

/**
 * Create the main window structure
 */
export function renderWindowStructure() {
  // Header — matches Bible window pattern: input.app-input + div.app-list
  const header = elem('div', { className: 'window-header flashcard-header' },
    elem('input', { type: 'text', className: 'app-input text-nav flashcard-ref-input', placeholder: 'Verse (e.g. John 3:16)' }),
    elem('div', { className: 'app-list text-list flashcard-version-btn', textContent: 'Version' }),
    elem('span', { className: 'flashcard-add-btn header-icon', title: 'Add to deck' }),
    elem('span', { className: 'flashcard-add-current-btn header-icon', title: 'Add current verse' }),
    elem('button', { className: 'flashcard-mode-btn flashcard-mode-deck active', textContent: 'Deck' }),
    elem('button', { className: 'flashcard-mode-btn flashcard-mode-review', textContent: 'Review' }),
    elem('div', { className: 'flashcard-header-spacer' }),
    elem('span', { className: 'flashcard-status' })
  );

  // Card list
  const cardList = elem('div', { className: 'flashcard-deck' },
    elem('div', { className: 'flashcard-card-list' }),
    elem('div', { className: 'flashcard-empty-state' },
      elem('p', 'No flashcards yet'),
      elem('p', 'Enter a verse reference and click + to add a card')
    )
  );

  // Review area
  const reviewArea = elem('div', { className: 'flashcard-review' },
    elem('div', { className: 'flashcard-progress' }),
    elem('div', { className: 'flashcard-card-container' },
      elem('div', { className: 'flashcard-card' },
        elem('div', { className: 'flashcard-card-front' },
          elem('div', { className: 'flashcard-card-reference' }),
          elem('div', { className: 'flashcard-card-version' }),
          elem('button', { className: 'flashcard-hint-btn', textContent: 'Show Hint' }),
          elem('div', { className: 'flashcard-card-hint' }),
          elem('div', { className: 'flashcard-card-tap', textContent: 'Click to reveal full verse' })
        ),
        elem('div', { className: 'flashcard-card-back' },
          elem('div', { className: 'flashcard-card-text' })
        )
      )
    ),
    elem('div', { className: 'flashcard-rating-buttons' },
      elem('button', { className: 'flashcard-rate-btn', dataset: { quality: '0' } },
        elem('span', { className: 'flashcard-rate-label', textContent: 'Again' }),
        elem('span', { className: 'flashcard-rate-detail', textContent: 'Reset' })
      ),
      elem('button', { className: 'flashcard-rate-btn', dataset: { quality: '1' } },
        elem('span', { className: 'flashcard-rate-label', textContent: 'Hard' }),
        elem('span', { className: 'flashcard-rate-detail', textContent: '1 day' })
      ),
      elem('button', { className: 'flashcard-rate-btn', dataset: { quality: '2' } },
        elem('span', { className: 'flashcard-rate-label', textContent: 'Good' }),
        elem('span', { className: 'flashcard-rate-detail', textContent: '' })
      ),
      elem('button', { className: 'flashcard-rate-btn', dataset: { quality: '3' } },
        elem('span', { className: 'flashcard-rate-label', textContent: 'Easy' }),
        elem('span', { className: 'flashcard-rate-detail', textContent: '' })
      )
    ),
  );

  // Main area
  const main = elem('div', { className: 'window-main flashcard-main' },
    cardList,
    reviewArea
  );

  return { header, main };
}

/**
 * Render a single card list item
 */
export function renderCardListItem(card) {
  return elem('div', {
    className: 'flashcard-list-item',
    dataset: { cardId: card.id }
  },
    elem('div', { className: 'flashcard-list-item-info' },
      elem('span', { className: 'flashcard-list-item-ref', textContent: card.referenceDisplay }),
      card.textid
        ? elem('span', { className: 'flashcard-list-item-version', textContent: card.textid })
        : null
    ),
    elem('div', { className: 'flashcard-list-item-meta' },
      elem('span', { className: 'flashcard-list-item-schedule', textContent: formatNextReview(card.nextReview) }),
      elem('span', { className: 'flashcard-list-item-reps', textContent: `${card.repetitions || 0} reviews` })
    ),
    elem('button', { className: 'flashcard-list-item-delete', title: 'Remove card', textContent: '\u00d7' })
  );
}

/**
 * Render the card list
 */
export function renderCardList(cards) {
  if (cards.length === 0) return document.createDocumentFragment();

  const fragment = document.createDocumentFragment();
  for (const card of cards) {
    fragment.appendChild(renderCardListItem(card));
  }
  return fragment;
}
