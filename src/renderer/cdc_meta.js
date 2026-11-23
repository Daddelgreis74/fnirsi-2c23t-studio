// Pure parsers for OpenScope USB-CDC identity ($VER) and update status ($UPD) frames.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CdcMeta = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const UPD_STATES = ['idle', 'staging', 'ready', 'error', 'applying'];

  function parseVerLine(line) {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed.startsWith('$VER,')) return null;
    const parts = trimmed.split(',');
    if (parts.length < 3) return null;
    const version = parts[1].trim();
    const hw = parts[2].trim();
    if (!version || !hw) return null;
    return { version, hw };
  }

  function parseUpdLine(line) {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed.startsWith('$UPD,')) return null;
    const parts = trimmed.split(',');
    if (parts.length < 5) return null;
    const state = parseInt(parts[1].trim(), 10);
    const error = parseInt(parts[2].trim(), 10);
    const bytes = parseInt(parts[3].trim(), 10);
    const expected = parseInt(parts[4].trim(), 10);
    if (![state, error, bytes, expected].every(Number.isFinite) || state < 0) return null;
    return {
      state,
      stateName: UPD_STATES[state] || 'unknown',
      error,
      bytes,
      expected
    };
  }

  return { parseVerLine, parseUpdLine, UPD_STATES };
});
