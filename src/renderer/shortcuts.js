// Pure keyboard shortcut rules and theme helper, shared by the renderer and the tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shortcuts = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const GLOBAL = { 1: 'tab-dmm', 2: 'tab-scope', 3: 'tab-generator', t: 'theme', '?': 'help' };
  const BY_TAB = {
    scope: { ' ': 'scope-run', a: 'scope-auto', c: 'scope-cursors', p: 'scope-capture' },
    dmm: { ' ': 'dmm-hold', h: 'dmm-hold', r: 'dmm-rel' }
  };

  function actionForKey({ key, tab, typing, ctrl, alt, meta }) {
    if (typing || ctrl || alt || meta) return null;
    const k = key.length === 1 ? key.toLowerCase() : key;
    return (BY_TAB[tab] && BY_TAB[tab][k]) || GLOBAL[k] || null;
  }

  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  return { actionForKey, normalizeTheme };
});
