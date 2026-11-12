// Pure rules deciding when telemetry from the device switches the Studio tab.
// The device announces every mode change with $MODE; the data frames ($DMM, $SCOPE, $WAVE) lag behind
// (the firmware even sends one $DMM frame after each switch), so they must not flip the tab once the mode is known.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TabSync = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const TAB_BY_MODE = { SCOPE: 'scope', DMM: 'dmm', GEN: 'generator' };

  // { mode, announced } for a telemetry line, or null.
  function lineInfo(line) {
    if (line.startsWith('$MODE,')) {
      const mode = (line.split(',')[1] || '').trim().toUpperCase();
      return TAB_BY_MODE[mode] ? { mode, announced: true } : null;
    }
    if (line.startsWith('$DMM,')) return { mode: 'DMM', announced: false };
    if (line.startsWith('$SCOPE,') || line.startsWith('$WAVE,')) return { mode: 'SCOPE', announced: false };
    return null;
  }

  function tabForLine(info, modeKnown) {
    if (!info) return null;
    return info.announced || !modeKnown ? TAB_BY_MODE[info.mode] : null;
  }

  return { lineInfo, tabForLine, TAB_BY_MODE };
});
