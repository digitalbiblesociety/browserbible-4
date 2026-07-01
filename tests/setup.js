// Vitest global setup. Runs before each test file.
// Extend with localStorage stubs, fetch mocks, or global error guards as suites grow.

// jsdom doesn't implement CSS.escape (used for verse-ID class selectors like ".MT2_1").
// Verse IDs are alphanumeric + underscore, so a minimal escape suffices here.
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {};
}
if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
