// Pure helpers for the multimeter value alert (beep while the reading is inside a target band).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DmmAlert = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // "3,3" or "3.3" -> 3.3 ; anything else (empty, units, text) -> null.
  function parseNumber(text) {
    const s = String(text).trim().replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }

  // True while |value - target| <= tolerance.
  function inBand(value, target, tolerance) {
    if (![value, target, tolerance].every((n) => typeof n === 'number' && isFinite(n)) || tolerance < 0) return false;
    // small epsilon so that 3.3 + 0.1 style edges are not lost to floating point
    return Math.abs(value - target) <= tolerance + 1e-9;
  }

  function signedValue(sign, magnitude) {
    return sign === '-' ? -magnitude : magnitude;
  }

  return { parseNumber, inBand, signedValue };
});
