// Decides when an open-but-silent telemetry stream has to be restarted.
//
// The 2C23T streams continuously while the oscilloscope or the multimeter is
// on screen, so a port that stays open while nothing arrives means the reader
// is wedged, not that the device is idle. Kept free of I/O so it can be tested.

const DEFAULT_IDLE_MS = 4000;

// `lastLineAt` is 0 (falsy) until the first line of a connection arrives. That
// keeps the watchdog quiet on screens that legitimately stream nothing, and it
// limits a silent connection to a single restart: the restart clears the mark
// again, so no further restart follows until real data has been seen.
function isStreamStalled({ connected, lastLineAt, now, idleMs = DEFAULT_IDLE_MS }) {
  if (!connected || !lastLineAt) return false;
  return now - lastLineAt >= idleMs;
}

module.exports = { isStreamStalled, DEFAULT_IDLE_MS };
