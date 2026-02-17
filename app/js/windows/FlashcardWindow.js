/**
 * FlashcardWindow - Web Component for verse memorization with spaced repetition
 */

import { BaseWindow, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { loadSection } from '../texts/TextLoader.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { getGlobalVerseNavigator } from '../ui/VerseNavigator.js';
import { sm2 } from './FlashcardWindow/sm2.js';
import {
  renderWindowStructure,
  renderCardList
} from './FlashcardWindow/render.js';

const STORAGE_KEY = 'browserbible_flashcards';

function generateId() {
  return 'card_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * FlashcardWindow Web Component
 * Provides verse memorization with SM-2 spaced repetition
 */
export class FlashcardWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      cards: [],
      mode: 'deck', // 'deck' or 'review'
      currentReference: null,
      currentReferenceDisplay: null,
      // Review session state
      reviewQueue: [],
      reviewIndex: 0,
      isFlipped: false
    };
  }

  async render() {
    this.innerHTML = '';
    const { header, main } = renderWindowStructure();
    this.appendChild(header);
    this.appendChild(main);
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.flashcard-header');
    this.refs.main = this.$('.flashcard-main');
    this.refs.status = this.$('.flashcard-status');

    // Mode buttons
    this.refs.modeDeck = this.$('.flashcard-mode-deck');
    this.refs.modeReview = this.$('.flashcard-mode-review');

    // Header controls
    this.refs.refInput = this.$('.flashcard-ref-input');
    this.refs.versionBtn = this.$('.flashcard-version-btn');
    this.refs.addBtn = this.$('.flashcard-add-btn');
    this.refs.addCurrentBtn = this.$('.flashcard-add-current-btn');

    // Deck
    this.refs.deck = this.$('.flashcard-deck');
    this.refs.cardList = this.$('.flashcard-card-list');
    this.refs.emptyState = this.$('.flashcard-empty-state');

    // Review
    this.refs.review = this.$('.flashcard-review');
    this.refs.progress = this.$('.flashcard-progress');
    this.refs.cardContainer = this.$('.flashcard-card-container');
    this.refs.card = this.$('.flashcard-card');
    this.refs.cardReference = this.$('.flashcard-card-reference');
    this.refs.cardVersion = this.$('.flashcard-card-version');
    this.refs.cardText = this.$('.flashcard-card-text');
    this.refs.cardHint = this.$('.flashcard-card-hint');
    this.refs.hintBtn = this.$('.flashcard-hint-btn');
    this.refs.cardTap = this.$('.flashcard-card-tap');
    this.refs.ratingButtons = this.$('.flashcard-rating-buttons');
  }

  attachEventListeners() {
    // Mode switching
    this.addListener(this.refs.modeDeck, 'click', () => this.setMode('deck'));
    this.addListener(this.refs.modeReview, 'click', () => this.startReview());

    // Add card via input
    this.addListener(this.refs.addBtn, 'click', () => this.addCardFromInput());
    this.addListener(this.refs.refInput, 'keydown', (e) => {
      if (e.key === 'Enter') this.addCardFromInput();
    });

    // Verse navigator
    this.verseNavigator = getGlobalVerseNavigator();
    this._verseNavHandler = (e) => this.handleVerseNavigatorChange(e);
    this.verseNavigator.on('change', this._verseNavHandler);
    this.addListener(this.refs.refInput, 'click', () => this.handleRefInputClick());

    // Version chooser
    this.textChooser = getGlobalTextChooser();
    this._textChooserHandler = (e) => this.handleTextChooserChange(e);
    this.textChooser.on('change', this._textChooserHandler);
    this.addListener(this.refs.versionBtn, 'click', () => this.handleVersionClick());

    // Add current verse
    this.addListener(this.refs.addCurrentBtn, 'click', () => this.addCurrentVerse());

    // Card list interactions
    this.addListener(this.refs.cardList, 'click', (e) => {
      const deleteBtn = e.target.closest('.flashcard-list-item-delete');
      if (deleteBtn) {
        const item = deleteBtn.closest('.flashcard-list-item');
        if (item) this.removeCard(item.dataset.cardId);
        return;
      }

      const info = e.target.closest('.flashcard-list-item-info');
      if (info) {
        const item = info.closest('.flashcard-list-item');
        if (item) this.previewCard(item.dataset.cardId);
      }
    });

    // Show hint (stop propagation so it doesn't flip)
    this.addListener(this.refs.hintBtn, 'click', (e) => {
      e.stopPropagation();
      this.showHint();
    });

    // Flip card
    this.addListener(this.refs.cardContainer, 'click', () => this.flipCard());

    // Rating buttons
    this.addListener(this.refs.ratingButtons, 'click', (e) => {
      const btn = e.target.closest('.flashcard-rate-btn');
      if (btn) {
        this.rateCard(parseInt(btn.dataset.quality, 10));
      }
    });

    // Keyboard shortcuts for review
    this.addListener(this, 'keydown', (e) => {
      if (this.state.mode !== 'review') return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!this.state.isFlipped) {
          this.flipCard();
        }
      } else if (this.state.isFlipped) {
        if (e.key === '1') this.rateCard(0);
        else if (e.key === '2') this.rateCard(1);
        else if (e.key === '3') this.rateCard(2);
        else if (e.key === '4') this.rateCard(3);
      }
    });

    // Navigation messages from Bible windows
    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    this.loadCards();
    this.renderDeck();

    const initMode = this.getParam('mode');
    if (initMode === 'review') {
      this.startReview();
    } else {
      this.setMode('deck');
    }
  }

  cleanup() {
    if (this._verseNavHandler && this.verseNavigator) {
      this.verseNavigator.off('change', this._verseNavHandler);
      this.verseNavigator.hide();
    }
    if (this._textChooserHandler && this.textChooser) {
      this.textChooser.off('change', this._textChooserHandler);
      this.textChooser.hide();
    }
    super.cleanup();
  }

  // --- Message handling ---

  handleMessage(e) {
    if (e.data.messagetype === 'nav' && e.data.type === 'bible' && e.data.locationInfo) {
      this.state.currentReference = e.data.locationInfo.fragmentid || null;
      this.state.currentReferenceDisplay = this.formatReferenceDisplay(e.data.locationInfo);
    }
  }

  handleRefInputClick() {
    this.textChooser.hide();

    if (this.verseNavigator.getTarget() === this.refs.refInput) {
      this.verseNavigator.toggle();
    } else {
      this.verseNavigator.setTarget(this, this.refs.refInput);
      if (this.state.selectedTextInfo) {
        this.verseNavigator.setTextInfo(this.state.selectedTextInfo);
      }
      this.verseNavigator.show();
    }
  }

  handleVerseNavigatorChange(e) {
    if (e.data.target !== this.refs.refInput) return;

    const fragmentid = e.data.fragmentid;
    if (!fragmentid) return;

    const ref = Reference(fragmentid);
    if (ref.isValid()) {
      this.refs.refInput.value = ref.toString();
    } else {
      this.refs.refInput.value = fragmentid;
    }
  }

  handleVersionClick() {
    this.verseNavigator.hide();

    if (this.textChooser.getTarget() === this.refs.versionBtn) {
      this.textChooser.toggle();
    } else {
      this.textChooser.setTarget(this, this.refs.versionBtn, 'bible');
      if (this.state.selectedTextInfo) {
        this.textChooser.setTextInfo(this.state.selectedTextInfo);
      }
      this.textChooser.show();
    }
  }

  handleTextChooserChange(e) {
    const target = e.data.target?.nodeType ? e.data.target : e.data.target?.[0];
    if (target !== this.refs.versionBtn) return;

    this.state.selectedTextInfo = e.data.textInfo;
    this.refs.versionBtn.textContent = e.data.textInfo.abbr || e.data.textInfo.id;
    this.verseNavigator.setTextInfo(e.data.textInfo);
  }

  getSelectedVersion() {
    return this.state.selectedTextInfo?.id || this.config.defaultBible || null;
  }

  formatReferenceDisplay(locationInfo) {
    if (!locationInfo?.fragmentid) return null;
    const ref = Reference(locationInfo.fragmentid);
    if (ref.isValid()) {
      return ref.toString();
    }
    return locationInfo.fragmentid;
  }

  // --- Persistence ---

  loadCards() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.state.cards = data.cards || [];
      } else {
        this.state.cards = [];
      }
    } catch (e) {
      console.error('Failed to load flashcards:', e);
      this.state.cards = [];
    }
  }

  saveCards() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cards: this.state.cards }));
    } catch (e) {
      console.error('Failed to save flashcards:', e);
    }
  }

  // --- Mode switching ---

  setMode(mode) {
    this.state.mode = mode;

    this.refs.modeDeck.classList.toggle('active', mode === 'deck');
    this.refs.modeReview.classList.toggle('active', mode === 'review');

    this.refs.deck.classList.toggle('hidden', mode !== 'deck');
    this.refs.review.classList.toggle('hidden', mode !== 'review');

    this.trigger('settingschange', { type: 'settingschange', target: this, data: null });
  }

  // --- Deck management ---

  addCardFromInput() {
    const input = this.refs.refInput.value.trim();
    if (!input) return;

    const ref = Reference(input);
    if (!ref.isValid()) {
      this.refs.status.textContent = 'Invalid reference';
      setTimeout(() => { this.refs.status.textContent = ''; }, 2000);
      return;
    }

    const reference = ref.toSection();
    const referenceDisplay = ref.toString();
    const textid = this.getSelectedVersion();

    // Check for duplicates (same reference + same version)
    if (this.state.cards.some(c => c.reference === reference && c.textid === textid)) {
      this.refs.status.textContent = 'Already in deck for this version';
      setTimeout(() => { this.refs.status.textContent = ''; }, 2000);
      return;
    }

    this.addCard(reference, referenceDisplay, textid);
    this.refs.refInput.value = '';
  }

  addCurrentVerse() {
    if (!this.state.currentReference) {
      this.refs.status.textContent = 'Navigate to a verse first';
      setTimeout(() => { this.refs.status.textContent = ''; }, 2000);
      return;
    }

    const reference = this.state.currentReference;
    const textid = this.getSelectedVersion();

    // Check for duplicates (same reference + same version)
    if (this.state.cards.some(c => c.reference === reference && c.textid === textid)) {
      this.refs.status.textContent = 'Already in deck for this version';
      setTimeout(() => { this.refs.status.textContent = ''; }, 2000);
      return;
    }

    const referenceDisplay = this.state.currentReferenceDisplay || reference;
    this.addCard(reference, referenceDisplay, textid);
  }

  addCard(reference, referenceDisplay, textid) {
    const card = {
      id: generateId(),
      reference,
      referenceDisplay,
      textid: textid || this.config.defaultBible || null,
      verseText: null,
      created: Date.now(),
      lastReviewed: null,
      nextReview: Date.now(), // Due immediately
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0
    };

    this.state.cards.unshift(card);
    this.saveCards();
    this.renderDeck();

    // Load verse text in background
    this.loadVerseText(card);

    const versionLabel = card.textid ? ` (${card.textid})` : '';
    this.refs.status.textContent = `Added ${referenceDisplay}${versionLabel}`;
    setTimeout(() => { this.refs.status.textContent = ''; }, 2000);
  }

  removeCard(cardId) {
    const index = this.state.cards.findIndex(c => c.id === cardId);
    if (index > -1) {
      this.state.cards.splice(index, 1);
      this.saveCards();
      this.renderDeck();
    }
  }

  loadVerseText(card) {
    if (card.verseText) return;

    const ref = Reference(card.reference);
    if (!ref.isValid()) return;

    const sectionId = ref.bookid + ref.chapter1;
    const textid = card.textid || this.config.defaultBible;

    if (!textid) return;

    loadSection(textid, sectionId, (el) => {
      // Extract the specific verse text from the chapter HTML
      const verseEl = el.querySelector(`[data-verse="${ref.verse1}"]`) ||
                      el.querySelector(`.v${ref.verse1}`) ||
                      el.querySelector(`[data-id="${card.reference}"]`);

      if (verseEl) {
        card.verseText = verseEl.textContent.trim();
      } else {
        // Try to find verse by scanning verse markers
        const verses = el.querySelectorAll('.verse, [data-verse]');
        for (const v of verses) {
          const vNum = v.dataset?.verse || v.className?.match(/\bv(\d+)\b/)?.[1];
          if (vNum && parseInt(vNum, 10) === ref.verse1) {
            card.verseText = v.textContent.trim();
            break;
          }
        }
      }

      if (!card.verseText) {
        // Fallback: get all text content from the section
        card.verseText = '(Verse text not available — review from your Bible)';
      }

      this.saveCards();
    }, () => {
      card.verseText = '(Could not load verse text)';
      this.saveCards();
    });
  }

  renderDeck() {
    this.refs.cardList.innerHTML = '';

    if (this.state.cards.length === 0) {
      this.refs.emptyState.classList.remove('hidden');
      this.refs.cardList.classList.add('hidden');
    } else {
      this.refs.emptyState.classList.add('hidden');
      this.refs.cardList.classList.remove('hidden');
      this.refs.cardList.appendChild(renderCardList(this.state.cards));
    }

    // Update review button count
    const dueCount = this.getDueCards().length;
    this.refs.modeReview.textContent = dueCount > 0 ? `Review (${dueCount})` : 'Review';
  }

  previewCard(cardId) {
    const card = this.state.cards.find(c => c.id === cardId);
    if (!card) return;

    this.state.reviewQueue = [card];
    this.state.reviewIndex = 0;
    this.state.isFlipped = false;

    this.setMode('review');
    this.refs.cardContainer.classList.remove('hidden');
    this.showCurrentCard();
  }

  // --- Review mode ---

  getDueCards() {
    const now = Date.now();
    return this.state.cards.filter(c => !c.nextReview || c.nextReview <= now);
  }

  startReview() {
    if (this.state.cards.length === 0) {
      this.showToast('Add some cards to get started.');
      return;
    }

    let queue = this.getDueCards();

    // If no cards are due, review all cards starting with the oldest reviewed
    if (queue.length === 0) {
      queue = [...this.state.cards].sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0));
    }

    this.state.reviewQueue = queue;
    this.state.reviewIndex = 0;
    this.state.isFlipped = false;

    this.setMode('review');
    this.refs.cardContainer.classList.remove('hidden');
    this.showCurrentCard();
  }

  showCurrentCard() {
    const card = this.state.reviewQueue[this.state.reviewIndex];
    if (!card) {
      this.finishReview();
      return;
    }

    this.state.isFlipped = false;
    this.refs.card.classList.remove('flipped');
    this.refs.ratingButtons.classList.add('hidden');

    this.refs.cardReference.textContent = card.referenceDisplay;
    this.refs.cardVersion.textContent = card.textid || '';
    this.refs.cardText.textContent = card.verseText || '(Loading...)';
    this.refs.cardHint.textContent = '';
    this.refs.cardHint.classList.remove('visible');
    this.refs.hintBtn.classList.remove('hidden');
    this.refs.cardTap.textContent = 'Click to reveal full verse';

    // If verse text isn't loaded yet, try loading it
    if (!card.verseText) {
      this.loadVerseText(card);
    }

    // Update progress
    const total = this.state.reviewQueue.length;
    const current = this.state.reviewIndex + 1;
    this.refs.progress.textContent = `${current} of ${total}`;

    // Update rating detail labels based on what SM-2 would produce
    this.updateRatingDetails(card);
  }

  updateRatingDetails(card) {
    const details = this.refs.ratingButtons.querySelectorAll('.flashcard-rate-detail');
    const qualities = [0, 1, 2, 3];

    for (let i = 0; i < qualities.length; i++) {
      const result = sm2(card, qualities[i]);
      if (result.interval === 0) {
        details[i].textContent = 'Again soon';
      } else if (result.interval === 1) {
        details[i].textContent = '1 day';
      } else {
        details[i].textContent = `${result.interval} days`;
      }
    }
  }

  showHint() {
    const card = this.state.reviewQueue[this.state.reviewIndex];
    if (!card || !card.verseText) return;

    // Show the first few words of the verse as a hint
    const words = card.verseText.split(/\s+/);
    const hintWords = words.slice(0, Math.min(5, Math.ceil(words.length / 4)));
    this.refs.cardHint.textContent = hintWords.join(' ') + ' \u2026';
    this.refs.cardHint.classList.add('visible');
    this.refs.hintBtn.classList.add('hidden');
  }

  flipCard() {
    if (this.state.mode !== 'review') return;
    if (this.state.reviewQueue.length === 0) return;

    const card = this.state.reviewQueue[this.state.reviewIndex];
    if (!card) return;

    // Re-read verse text in case it loaded asynchronously
    this.refs.cardText.textContent = card.verseText || '(Loading...)';

    this.state.isFlipped = true;
    this.refs.card.classList.add('flipped');
    this.refs.ratingButtons.classList.remove('hidden');
    this.refs.cardTap.textContent = '';
  }

  rateCard(quality) {
    const card = this.state.reviewQueue[this.state.reviewIndex];
    if (!card) return;

    // Apply SM-2 algorithm
    const result = sm2(card, quality);
    card.easeFactor = result.easeFactor;
    card.interval = result.interval;
    card.repetitions = result.repetitions;
    card.nextReview = result.nextReview;
    card.lastReviewed = Date.now();

    this.saveCards();

    // Move to next card
    this.state.reviewIndex++;
    if (this.state.reviewIndex < this.state.reviewQueue.length) {
      this.showCurrentCard();
    } else {
      this.finishReview();
    }
  }

  finishReview() {
    this.setMode('deck');
    this.renderDeck();
    this.showToast('All caught up! No more cards due.');
  }

  showToast(message) {
    // Remove any existing toast
    const existing = this.$('.flashcard-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'flashcard-toast';
    toast.textContent = message;
    this.appendChild(toast);

    // Trigger reflow then add visible class for animation
    void toast.offsetHeight;
    toast.classList.add('visible');

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- Layout ---

  size(width, height) {
    if (this.refs.header) {
      this.refs.header.style.width = `${width}px`;
    }
    if (this.refs.main) {
      this.refs.main.style.width = `${width}px`;
      this.refs.main.style.height = `${height - (this.refs.header?.offsetHeight || 40)}px`;
    }
  }

  getData() {
    return {
      params: {
        win: 'flashcard',
        mode: this.state.mode
      }
    };
  }
}

registerWindowComponent('flashcard-window', FlashcardWindowComponent, {
  windowType: 'flashcard',
  displayName: 'Flashcards',
  paramKeys: { mode: 'm' }
});

export { FlashcardWindowComponent as FlashcardWindow };

export default FlashcardWindowComponent;
