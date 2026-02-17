/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo SM-2 algorithm by Piotr Wozniak
 *
 * Quality ratings:
 *   0 = Again (complete failure)
 *   1 = Hard (significant difficulty)
 *   2 = Good (correct with some hesitation)
 *   3 = Easy (perfect recall)
 */

/**
 * Calculate next review schedule based on SM-2 algorithm
 * @param {Object} card - Card with easeFactor, interval, repetitions
 * @param {number} quality - Rating 0-3
 * @returns {Object} Updated { easeFactor, interval, repetitions, nextReview }
 */
export function sm2(card, quality) {
  let { easeFactor = 2.5, interval = 0, repetitions = 0 } = card;

  // Map 0-3 scale to SM-2's 0-5 scale: 0→0, 1→2, 2→4, 3→5
  const q = [0, 2, 4, 5][quality] ?? 0;

  if (q < 3) {
    // Failed recall — reset
    repetitions = 0;
    interval = 0;
  } else {
    // Successful recall
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

  return { easeFactor, interval, repetitions, nextReview };
}
