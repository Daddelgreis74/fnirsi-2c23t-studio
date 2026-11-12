// Pure serial bus decoders (UART, I2C, SPI) working on the 180-sample frames streamed by the scope.
// With so few samples only slow buses are readable: the UART decoder refuses anything under 3 samples per bit.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BusDecode = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // 12 divisions wide, as the firmware draws it (SCOPE_X_DIVS).
  const X_DIVS = 12;
  const MIN_SPAN_COUNTS = 8;
  const MIN_SAMPLES_PER_BIT = 3;
  const STANDARD_BAUDS = [300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

  // Raw samples -> logic levels through a mid-level threshold with hysteresis, or null for a flat signal.
  function digitize(wave) {
    if (!wave || wave.length < 2) return null;
    const lo = Math.min(...wave);
    const hi = Math.max(...wave);
    if (hi - lo < MIN_SPAN_COUNTS) return null;
    const mid = (hi + lo) / 2;
    const h = (hi - lo) * 0.1;
    const bits = new Uint8Array(wave.length);
    let high = wave[0] >= mid;
    for (let i = 0; i < wave.length; i++) {
      if (!high && wave[i] >= mid + h) high = true;
      else if (high && wave[i] <= mid - h) high = false;
      bits[i] = high ? 1 : 0;
    }
    return { bits };
  }

  const samplePeriodNs = (n, tbNs) => (tbNs * X_DIVS) / (n - 1);

  // 8N1, idle high, LSB first.
  function decodeUart(wave, { baud, tbNs }) {
    const dig = digitize(wave);
    if (!dig) return { bytes: [], error: 'no_signal' };
    const { bits } = dig;
    const spb = 1e9 / (baud * samplePeriodNs(bits.length, tbNs));
    if (spb < MIN_SAMPLES_PER_BIT) return { bytes: [], error: 'too_fast' };
    const bytes = [];
    for (let i = 1; i < bits.length; i++) {
      if (!(bits[i - 1] === 1 && bits[i] === 0)) continue;
      const stop = Math.round(i + 9.5 * spb);
      if (stop >= bits.length) break;
      if (bits[stop] !== 1) continue; // framing error
      let value = 0;
      for (let k = 0; k < 8; k++) value |= bits[Math.round(i + (1.5 + k) * spb)] << k;
      bytes.push({ value, index: i });
      i = stop;
    }
    return { bytes };
  }

  // Shortest pulse -> nearest standard baud rate (within about 40 %), or null.
  function estimateBaud(wave, tbNs) {
    const dig = digitize(wave);
    if (!dig) return null;
    const { bits } = dig;
    const runs = [];
    let start = 0;
    for (let i = 1; i <= bits.length; i++) {
      if (i === bits.length || bits[i] !== bits[i - 1]) {
        if (start > 0 && i < bits.length) runs.push(i - start); // skip the cut-off first and last runs
        start = i;
      }
    }
    if (!runs.length) return null;
    const baud = 1e9 / (Math.min(...runs) * samplePeriodNs(bits.length, tbNs));
    const nearest = STANDARD_BAUDS.reduce((a, b) => (Math.abs(Math.log(b / baud)) < Math.abs(Math.log(a / baud)) ? b : a));
    const ratio = baud / nearest;
    return ratio > 0.7 && ratio < 1.43 ? nearest : null;
  }

  // CH1 = SCL, CH2 = SDA. Events: start, addr, data, stop.
  function decodeI2c(sclWave, sdaWave) {
    const scl = digitize(sclWave);
    const sda = digitize(sdaWave);
    if (!scl || !sda || scl.bits.length !== sda.bits.length) return [];
    const events = [];
    let inFrame = false;
    let first = true;
    let count = 0;
    let cur = 0;
    for (let i = 1; i < scl.bits.length; i++) {
      const cp = scl.bits[i - 1];
      const cn = scl.bits[i];
      const dp = sda.bits[i - 1];
      const dn = sda.bits[i];
      if (cp === 1 && cn === 1 && dp !== dn) {
        if (dn === 0) {
          events.push({ type: 'start' });
          inFrame = true; first = true; count = 0; cur = 0;
        } else if (inFrame) {
          events.push({ type: 'stop' });
          inFrame = false;
        }
      } else if (cp === 0 && cn === 1 && inFrame) {
        if (count < 8) {
          cur = (cur << 1) | dn;
          count++;
        } else {
          const ack = dn === 0;
          events.push(first ? { type: 'addr', addr: cur >> 1, write: (cur & 1) === 0, ack } : { type: 'data', value: cur, ack });
          first = false; count = 0; cur = 0;
        }
      }
    }
    return events;
  }

  const hex = (v) => `0x${v.toString(16).toUpperCase().padStart(2, '0')}`;

  function formatI2c(events) {
    let out = '';
    for (const e of events) {
      if (e.type === 'start') out += (out ? ' ' : '') + 'S';
      else if (e.type === 'addr') out += ` ${hex(e.addr)} ${e.write ? 'W' : 'R'} ${e.ack ? 'A' : 'N'}`;
      else if (e.type === 'data') out += ` | ${hex(e.value)} ${e.ack ? 'A' : 'N'}`;
      else out += ' P';
    }
    return out;
  }

  // CH1 = clock, CH2 = data, mode 0 (sample on rising edges), MSB first, 8 bits per byte.
  function decodeSpi(clkWave, dataWave) {
    const clk = digitize(clkWave);
    const dat = digitize(dataWave);
    if (!clk || !dat || clk.bits.length !== dat.bits.length) return [];
    const bytes = [];
    let count = 0;
    let cur = 0;
    for (let i = 1; i < clk.bits.length; i++) {
      if (clk.bits[i - 1] === 0 && clk.bits[i] === 1) {
        cur = (cur << 1) | dat.bits[i];
        if (++count === 8) {
          bytes.push({ value: cur, index: i });
          count = 0; cur = 0;
        }
      }
    }
    return bytes;
  }

  function formatBytes(bytes) {
    if (!bytes.length) return '';
    const hexes = bytes.map((b) => b.value.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const ascii = bytes.map((b) => (b.value >= 0x20 && b.value < 0x7f ? String.fromCharCode(b.value) : '.')).join('');
    return `${hexes}  "${ascii}"`;
  }

  return { digitize, decodeUart, estimateBaud, decodeI2c, formatI2c, decodeSpi, formatBytes, STANDARD_BAUDS };
});
