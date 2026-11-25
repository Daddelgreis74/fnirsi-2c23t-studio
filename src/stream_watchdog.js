// Decides when an open-but-silent telemetry stream has to be restarted.
//
// Only an actively running oscilloscope streams continuously (~15 Hz). DMM,
// Generator, paused Scope (run=0), and one-shot queries ($VER/$GEN/$UPD/$SHOT)
// are event-driven or silent, so they must disarm or never arm the watchdog.

const DEFAULT_IDLE_MS = 4000;

function nextWatchdogMark(line, currentMark, now) {
  const trimmed = typeof line === 'string' ? line.trim() : '';
  if (!trimmed) return currentMark;
  if (trimmed.startsWith('$WAVE,')) return now;
  if (trimmed.startsWith('$SCOPE,')) {
    const parts = trimmed.split(',');
    if (parts.length >= 9 && parts[8].trim() === '0') return 0;
    return now;
  }
  if (
    trimmed.startsWith('$MODE,DMM') ||
    trimmed.startsWith('$MODE,GEN') ||
    trimmed.startsWith('$DMM,') ||
    trimmed.startsWith('$GEN,') ||
    trimmed.startsWith('$UPD,')
  ) {
    return 0;
  }
  return currentMark;
}

// `lastLineAt` is 0 (falsy) until continuous Scope streaming arrives. That
// keeps the watchdog quiet on DMM/GEN/idle screens, and it limits a stalled
// Scope connection to a single restart per drop.
function isStreamStalled({ connected, lastLineAt, now, idleMs = DEFAULT_IDLE_MS }) {
  if (!connected || !lastLineAt) return false;
  return now - lastLineAt >= idleMs;
}

module.exports = { isStreamStalled, nextWatchdogMark, DEFAULT_IDLE_MS };
