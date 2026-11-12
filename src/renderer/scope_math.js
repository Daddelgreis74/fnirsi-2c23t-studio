// Pure oscilloscope maths (measurements, cursors, unit formatting), shared by the renderer and the tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScopeMath = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const X_DIVS = 10;
  const Y_DIVS = 8;
  const RAW_ZERO = 128;
  const RAW_FULL = 255;

  // Firmware chip labels: volts per division "20M" / "1V" and time per division "50N" / "1M" / "5S".
  function parseVdivMv(label) {
    const m = /^(\d+(?:\.\d+)?)\s*(M|MV|V)$/i.exec(String(label).trim());
    if (!m) return null;
    return /^m/i.test(m[2]) ? Number(m[1]) : Number(m[1]) * 1000;
  }

  function parseTimebaseNs(label) {
    const m = /^(\d+(?:\.\d+)?)\s*(N|U|M|S)S?$/i.exec(String(label).trim());
    if (!m) return null;
    const unit = { N: 1, U: 1e3, M: 1e6, S: 1e9 }[m[2].toUpperCase()];
    return Number(m[1]) * unit;
  }

  // Same scaling as the device: Y_DIVS divisions over the 0..255 raw range.
  function rawToMv(raw, vdivMv) {
    return ((raw - RAW_ZERO) * vdivMv * Y_DIVS) / RAW_FULL;
  }

  // Position (in samples, interpolated) where the signal crosses `level` going up or down.
  function crossings(v, level, rising) {
    const out = [];
    for (let i = 1; i < v.length; i++) {
      const a = v[i - 1];
      const b = v[i];
      if (rising ? (a < level && b >= level) : (a >= level && b < level)) out.push(i - 1 + (level - a) / (b - a));
    }
    return out;
  }

  function measureWave(samples, vdivMv, tbNs) {
    if (!samples || samples.length < 2 || !vdivMv || !tbNs) return null;
    const n = samples.length;
    const v = Array.from(samples, (r) => rawToMv(r, vdivMv));
    const vmax = Math.max(...v);
    const vmin = Math.min(...v);
    const vpp = vmax - vmin;
    const vmean = v.reduce((a, b) => a + b, 0) / n;
    const vrms = Math.sqrt(v.reduce((a, b) => a + b * b, 0) / n);
    const result = { vmax, vmin, vpp, vmean, vrms, freqHz: null, dutyPct: null, riseNs: null };
    if (vpp <= 0) return result;

    const samplePeriodNs = (tbNs * X_DIVS) / (n - 1);
    const mid = (vmax + vmin) / 2;
    const up = crossings(v, mid, true);
    const down = crossings(v, mid, false);

    if (up.length >= 2) {
      const period = (up[up.length - 1] - up[0]) / (up.length - 1);
      result.freqHz = 1e9 / (period * samplePeriodNs);
      const fall = down.find((d) => d > up[0] && d < up[1]);
      if (fall !== undefined) result.dutyPct = ((fall - up[0]) / (up[1] - up[0])) * 100;
    }

    const lo = crossings(v, vmin + 0.1 * vpp, true);
    const hi = crossings(v, vmin + 0.9 * vpp, true);
    if (lo.length) {
      const end = hi.find((h) => h > lo[0]);
      if (end !== undefined) result.riseNs = (end - lo[0]) * samplePeriodNs;
    }
    return result;
  }

  // Cursor positions are in divisions: x from the left edge (0..10), y from the channel centre (+ is up).
  function cursorReadout({ x1, x2, y1, y2 }, vdivMv, tbNs) {
    const dtNs = Math.abs(x2 - x1) * tbNs;
    return {
      dtNs,
      freqHz: dtNs > 0 ? 1e9 / dtNs : null,
      v1Mv: y1 * vdivMv,
      v2Mv: y2 * vdivMv,
      dvMv: Math.abs(y2 - y1) * vdivMv
    };
  }

  function formatVoltage(mv) {
    return Math.abs(mv) >= 1000 ? `${(mv / 1000).toFixed(2)} V` : `${Math.round(mv)} mV`;
  }

  function formatTime(ns) {
    if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)} s`;
    if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
    if (ns >= 1e3) return `${(ns / 1e3).toFixed(1)} µs`;
    return `${Math.round(ns)} ns`;
  }

  function formatFreq(hz) {
    if (hz === null || hz === undefined || !isFinite(hz)) return '--';
    if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
    if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
    return `${hz.toFixed(1)} Hz`;
  }

  return { X_DIVS, Y_DIVS, parseVdivMv, parseTimebaseNs, rawToMv, measureWave, cursorReadout, formatVoltage, formatTime, formatFreq };
});
