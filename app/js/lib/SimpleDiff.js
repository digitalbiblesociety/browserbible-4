/**
 * SimpleDiff - Lightweight word-level diff utility
 * Uses LCS (Longest Common Subsequence) algorithm
 */

/**
 * Compute word-level differences between two strings
 * @param {string} oldText - Original text
 * @param {string} newText - New text to compare
 * @returns {Array<{value: string, added?: boolean, removed?: boolean}>} Diff parts
 */
export function diffWords(oldText, newText) {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);
  const lcs = computeLCS(oldWords, newWords);
  return buildDiff(oldWords, newWords, lcs);
}

function tokenize(text) {
  const tokens = [];
  const regex = /(\s+|\S+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0]);
  }

  return tokens;
}

function computeLCS(oldTokens, newTokens) {
  const m = oldTokens.length;
  const n = newTokens.length;
  const table = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

function getNextOp(oldTokens, newTokens, lcs, i, j) {
  if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
    return { value: oldTokens[i - 1], type: 'same', di: 1, dj: 1 };
  }
  if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
    return { value: newTokens[j - 1], type: 'added', di: 0, dj: 1 };
  }
  return { value: oldTokens[i - 1], type: 'removed', di: 1, dj: 0 };
}

function mergeOps(ops) {
  const result = [];
  let current = null;

  for (const op of ops) {
    if (current && current.type === op.type) {
      current.value += op.value;
    } else {
      if (current) result.push(formatPart(current));
      current = { ...op };
    }
  }

  if (current) result.push(formatPart(current));
  return result;
}

function buildDiff(oldTokens, newTokens, lcs) {
  const ops = [];
  let i = oldTokens.length;
  let j = newTokens.length;

  while (i > 0 || j > 0) {
    const op = getNextOp(oldTokens, newTokens, lcs, i, j);
    ops.push({ value: op.value, type: op.type });
    i -= op.di;
    j -= op.dj;
  }

  ops.reverse();
  return mergeOps(ops);
}

function formatPart(part) {
  const result = { value: part.value };
  if (part.type === 'added') result.added = true;
  if (part.type === 'removed') result.removed = true;
  return result;
}

export default { diffWords };
