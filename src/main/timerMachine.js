const FOCUS_DURATION = 20 * 60
const BREAK_DURATION = 20
const START_GUARD_MS = 400

function createInitialState() {
  return {
    phase: 'focus',
    remaining: FOCUS_DURATION,
    isPaused: false,
    stats: { breaksToday: 0, focusTime: 0 },
  }
}

// Returns same reference when there is nothing to do (isPaused, frozen phase).
// Caller can use reference equality to detect no-ops.
function tick(state) {
  if (state.isPaused) return state
  if (state.phase !== 'focus' && state.phase !== 'break') return state

  const next = {
    ...state,
    remaining: state.remaining - 1,
    stats: { ...state.stats },
  }

  if (state.phase === 'focus') next.stats.focusTime++

  if (next.remaining <= 0) {
    if (state.phase === 'focus') {
      next.phase = 'reminder'
      next.remaining = BREAK_DURATION
    } else {
      next.stats.breaksToday++
      next.phase = 'focus'
      next.remaining = FOCUS_DURATION
    }
  }

  return next
}

// Returns same reference when phase is not 'reminder'.
function acknowledge(state) {
  if (state.phase !== 'reminder') return state
  return { ...state, phase: 'ready' }
}

// readyAt and now are timestamps (ms). Returns same reference on no-op.
function startBreak(state, readyAt, now) {
  if (state.phase !== 'ready') return state
  if (now - readyAt < START_GUARD_MS) return state
  return { ...state, phase: 'break', remaining: BREAK_DURATION }
}

function skipBreak(state) {
  return {
    ...state,
    phase: 'focus',
    remaining: FOCUS_DURATION,
    stats: { ...state.stats, breaksToday: state.stats.breaksToday + 1 },
  }
}

function pause(state) {
  return { ...state, isPaused: true }
}

function resume(state) {
  return { ...state, isPaused: false }
}

// Resets timer back to focus; preserves today's stats.
function reset(state) {
  return {
    phase: 'focus',
    remaining: FOCUS_DURATION,
    isPaused: false,
    stats: { ...state.stats },
  }
}

module.exports = {
  FOCUS_DURATION,
  BREAK_DURATION,
  START_GUARD_MS,
  createInitialState,
  tick,
  acknowledge,
  startBreak,
  skipBreak,
  pause,
  resume,
  reset,
}
