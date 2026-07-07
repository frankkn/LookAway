const FOCUS_DURATION = 20 * 60
const BREAK_DURATION = 20
const START_GUARD_MS = 400
const MAX_TICK_CATCHUP = 5 // s; larger gaps (sleep/hibernate) count as paused time

function createInitialState(focusDuration = FOCUS_DURATION, breakDuration = BREAK_DURATION) {
  return {
    phase: 'focus',
    remaining: focusDuration,
    isPaused: false,
    focusDuration,
    breakDuration,
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
      next.remaining = state.breakDuration ?? BREAK_DURATION
    } else {
      // Break finished: freeze in 'done' until the user clicks 繼續工作 —
      // they may still be looking away and shouldn't lose focus time silently.
      next.stats.breaksToday++
      next.phase = 'done'
      next.remaining = state.focusDuration ?? FOCUS_DURATION
    }
  }

  return next
}

// Returns same reference when phase is not 'reminder'.
// shownAt/now are timestamps (ms): the reminder steals focus with an
// auto-focused OK button, so an Enter typed at the wrong moment would dismiss
// it before the user ever sees it — ignore acknowledge right after it appears.
function acknowledge(state, shownAt = -Infinity, now = 0) {
  if (state.phase !== 'reminder') return state
  if (now - shownAt < START_GUARD_MS) return state
  return { ...state, phase: 'ready' }
}

// readyAt and now are timestamps (ms). Returns same reference on no-op.
function startBreak(state, readyAt, now) {
  if (state.phase !== 'ready') return state
  if (now - readyAt < START_GUARD_MS) return state
  return { ...state, phase: 'break', remaining: state.breakDuration ?? BREAK_DURATION }
}

// Returns same reference when phase is not 'break' (e.g. a double-click on
// Skip whose second click lands after the phase already flipped to focus).
// 'done' is frozen; the user clicks 繼續工作 to start the next focus round.
// Returns same reference outside 'done'.
function startFocus(state) {
  if (state.phase !== 'done') return state
  return { ...state, phase: 'focus', remaining: state.focusDuration ?? FOCUS_DURATION }
}

function skipBreak(state) {
  if (state.phase !== 'break') return state
  return {
    ...state,
    phase: 'focus',
    remaining: state.focusDuration ?? FOCUS_DURATION,
    stats: { ...state.stats, breaksToday: state.stats.breaksToday + 1 },
  }
}

function pause(state) {
  return { ...state, isPaused: true }
}

function resume(state) {
  return { ...state, isPaused: false }
}

// Resets the focus countdown; preserves today's stats and durations.
// No-op outside focus so a click racing the focus→reminder transition
// cannot silently cancel the break.
function reset(state) {
  if (state.phase !== 'focus') return state
  return {
    ...state,
    phase: 'focus',
    remaining: state.focusDuration ?? FOCUS_DURATION,
    isPaused: false,
  }
}

// Wall-clock pacing for the tick loop. setInterval drifts (throttling, load),
// so the caller tracks lastTick and asks how many whole seconds have really
// elapsed. Returns { steps, lastTick }: lastTick advances past every whole
// second (keeping the sub-second remainder), while steps is capped so a
// suspend/resume gap doesn't fast-forward the countdown on wake.
function advance(lastTick, now) {
  const whole = Math.floor((now - lastTick) / 1000)
  if (whole <= 0) return { steps: 0, lastTick }
  return {
    steps: Math.min(whole, MAX_TICK_CATCHUP),
    lastTick: lastTick + whole * 1000,
  }
}

// Called when the user saves new durations in settings. Clamps the current
// countdown so shortening a duration takes effect this cycle, not the next.
function applyDurations(state, focusDuration, breakDuration) {
  const next = { ...state, focusDuration, breakDuration }
  if (state.phase === 'focus') next.remaining = Math.min(state.remaining, focusDuration)
  else if (state.phase === 'break') next.remaining = Math.min(state.remaining, breakDuration)
  else if (state.phase === 'done') next.remaining = focusDuration // holds the upcoming focus length
  else next.remaining = breakDuration // reminder/ready hold the upcoming break length
  return next
}

module.exports = {
  FOCUS_DURATION,
  BREAK_DURATION,
  START_GUARD_MS,
  MAX_TICK_CATCHUP,
  createInitialState,
  tick,
  advance,
  acknowledge,
  startBreak,
  startFocus,
  skipBreak,
  pause,
  resume,
  reset,
  applyDurations,
}
