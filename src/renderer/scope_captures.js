// Pure helpers for the scope capture history (snapshots of the streamed waveforms), shared with the tests.
(function (root, factory) {
  const api = factory(typeof require === 'function' && typeof module !== 'undefined' ? require('./scope_math.js') : root.ScopeMath);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScopeCaptures = api;
})(typeof self !== 'undefined' ? self : this, function (ScopeMath) {
  function createStore(max) {
    let items = [];
    let nextId = 1;
    return {
      add(capture) {
        const item = {
          ...capture,
          id: nextId++,
          wave1: capture.wave1 ? Uint8Array.from(capture.wave1) : null,
          wave2: capture.wave2 ? Uint8Array.from(capture.wave2) : null
        };
        items.push(item);
        if (items.length > max) items = items.slice(items.length - max);
        return item;
      },
      get: (id) => items.find((c) => c.id === id),
      remove(id) { items = items.filter((c) => c.id !== id); },
      clear() { items = []; },
      list: () => items.slice()
    };
  }

  function isCapturable({ ch1En, ch2En, wave1, wave2 }) {
    return Boolean((ch1En && wave1) || (ch2En && wave2));
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function captureLabel(c) {
    const d = c.takenAt;
    const parts = [`#${c.id}`, `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, c.tb];
    if (c.ch1En && c.wave1) parts.push(`CH1 ${c.v1}`);
    if (c.ch2En && c.wave2) parts.push(`CH2 ${c.v2}`);
    return parts.join(' · ');
  }

  // Semicolon separated with decimal commas, like the multimeter export.
  function captureToCsv(c) {
    const tbNs = ScopeMath.parseTimebaseNs(c.tb);
    const channels = [[1, c.ch1En && c.wave1, c.v1], [2, c.ch2En && c.wave2, c.v2]].filter(([, w]) => w);
    const n = channels.length ? channels[0][1].length : 0;
    const num = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
    const rows = [['Zeit_ns', ...channels.map(([ch]) => `CH${ch}_mV`)].join(';')];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? Math.round((i / (n - 1)) * ScopeMath.X_DIVS * tbNs) : 0;
      rows.push([t, ...channels.map(([, w, v]) => num(ScopeMath.rawToMv(w[i], ScopeMath.parseVdivMv(v))))].join(';'));
    }
    return rows.join('\r\n') + '\r\n';
  }

  return { createStore, isCapturable, captureLabel, captureToCsv };
});
