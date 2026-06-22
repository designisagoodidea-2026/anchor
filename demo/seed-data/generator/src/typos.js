// Anchor seed generator — typo application.
//
// Apply realistic typos to a string at a given rate. Three move types:
//   - adjacent character swap ("the" → "teh")
//   - drop a letter        ("through" → "thrugh")
//   - double a letter      ("running" → "runnning")
//
// Typos avoid mangling decision tokens or markdown structure — only word
// characters get touched. Headers, code fences, and the literal string
// "[decision]" are left alone so the renderer still picks them up cleanly.

const PROTECTED_TOKENS = ["[decision]"];

/**
 * @param {string} text
 * @param {number} rate  Probability a given word receives a typo.
 * @returns {string}
 */
export function applyTypos(text, rate) {
  if (rate <= 0) return text;
  // Split into segments preserving whitespace and punctuation so we only
  // mangle word-internal characters.
  return text
    .split(/(\s+)/)
    .map((segment) => {
      if (/^\s*$/.test(segment)) return segment;
      if (PROTECTED_TOKENS.some((tok) => segment.includes(tok))) return segment;
      if (segment.length < 4) return segment;
      if (Math.random() > rate) return segment;
      return mangle(segment);
    })
    .join("");
}

/**
 * @param {string} word
 * @returns {string}
 */
function mangle(word) {
  const choice = Math.random();
  // Pick an interior index — never touch the first or last character.
  const idx = 1 + Math.floor(Math.random() * (word.length - 2));
  if (choice < 0.4) {
    // Adjacent swap.
    const chars = word.split("");
    [chars[idx], chars[idx + 1]] = [chars[idx + 1], chars[idx]];
    return chars.join("");
  }
  if (choice < 0.75) {
    // Drop.
    return word.slice(0, idx) + word.slice(idx + 1);
  }
  // Double.
  return word.slice(0, idx) + word[idx] + word.slice(idx);
}
