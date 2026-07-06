import { describe, it, expect } from 'vitest'
import {
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
} from '../src/main/timerMachine.js'

describe('createInitialState', () => {
  it('starts in focus phase with full duration', () => {
    const s = createInitialState()
    expect(s.phase).toBe('focus')
    expect(s.remaining).toBe(FOCUS_DURATION)
    expect(s.isPaused).toBe(false)
    expect(s.stats).toEqual({ breaksToday: 0, focusTime: 0 })
  })
})

describe('tick', () => {
  it('decrements remaining in focus phase', () => {
    const s = createInitialState()
    const next = tick(s)
    expect(next.remaining).toBe(FOCUS_DURATION - 1)
    expect(next.phase).toBe('focus')
  })

  it('increments focusTime each tick in focus phase', () => {
    const s = createInitialState()
    const next = tick(s)
    expect(next.stats.focusTime).toBe(1)
  })

  it('does not mutate the original state object', () => {
    const s = createInitialState()
    tick(s)
    expect(s.remaining).toBe(FOCUS_DURATION)
  })

  it('returns same reference when paused (no-op)', () => {
    const s = { ...createInitialState(), isPaused: true }
    expect(tick(s)).toBe(s)
  })

  it('returns same reference in reminder phase (frozen)', () => {
    const s = { ...createInitialState(), phase: 'reminder' }
    expect(tick(s)).toBe(s)
  })

  it('returns same reference in ready phase (frozen)', () => {
    const s = { ...createInitialState(), phase: 'ready' }
    expect(tick(s)).toBe(s)
  })

  it('transitions focus → reminder when remaining reaches 0', () => {
    const s = { ...createInitialState(), remaining: 1 }
    const next = tick(s)
    expect(next.phase).toBe('reminder')
    expect(next.remaining).toBe(BREAK_DURATION)
  })

  it('still increments focusTime on the final focus tick', () => {
    const s = { ...createInitialState(), remaining: 1, stats: { breaksToday: 0, focusTime: 10 } }
    const next = tick(s)
    expect(next.stats.focusTime).toBe(11)
  })

  it('decrements remaining in break phase', () => {
    const s = { ...createInitialState(), phase: 'break', remaining: BREAK_DURATION }
    const next = tick(s)
    expect(next.remaining).toBe(BREAK_DURATION - 1)
    expect(next.phase).toBe('break')
  })

  it('transitions break → focus and increments breaksToday when remaining reaches 0', () => {
    const s = { ...createInitialState(), phase: 'break', remaining: 1 }
    const next = tick(s)
    expect(next.phase).toBe('focus')
    expect(next.remaining).toBe(FOCUS_DURATION)
    expect(next.stats.breaksToday).toBe(1)
  })

  it('does not increment focusTime during break phase', () => {
    const s = { ...createInitialState(), phase: 'break', remaining: BREAK_DURATION }
    const next = tick(s)
    expect(next.stats.focusTime).toBe(0)
  })
})

describe('acknowledge', () => {
  it('transitions reminder → ready', () => {
    const s = { ...createInitialState(), phase: 'reminder' }
    expect(acknowledge(s).phase).toBe('ready')
  })

  it('returns same reference when not in reminder phase', () => {
    const s = createInitialState() // focus
    expect(acknowledge(s)).toBe(s)
  })
})

describe('startBreak', () => {
  const readyAt = 1000

  it('transitions ready → break after the guard window', () => {
    const s = { ...createInitialState(), phase: 'ready' }
    const next = startBreak(s, readyAt, readyAt + START_GUARD_MS + 1)
    expect(next.phase).toBe('break')
    expect(next.remaining).toBe(BREAK_DURATION)
  })

  it('returns same reference when called within the guard window', () => {
    const s = { ...createInitialState(), phase: 'ready' }
    expect(startBreak(s, readyAt, readyAt + START_GUARD_MS - 1)).toBe(s)
  })

  it('returns same reference when not in ready phase', () => {
    const s = createInitialState() // focus
    expect(startBreak(s, readyAt, readyAt + START_GUARD_MS + 1)).toBe(s)
  })
})

describe('skipBreak', () => {
  it('always transitions to focus phase', () => {
    for (const phase of ['focus', 'reminder', 'ready', 'break']) {
      const s = { ...createInitialState(), phase }
      const next = skipBreak(s)
      expect(next.phase).toBe('focus')
      expect(next.remaining).toBe(FOCUS_DURATION)
    }
  })

  it('increments breaksToday', () => {
    const s = { ...createInitialState(), stats: { breaksToday: 2, focusTime: 100 } }
    expect(skipBreak(s).stats.breaksToday).toBe(3)
  })
})

describe('pause / resume', () => {
  it('pause sets isPaused to true', () => {
    expect(pause(createInitialState()).isPaused).toBe(true)
  })

  it('resume sets isPaused to false', () => {
    const s = { ...createInitialState(), isPaused: true }
    expect(resume(s).isPaused).toBe(false)
  })
})

describe('reset', () => {
  it('resets to focus phase with full duration', () => {
    const s = { phase: 'break', remaining: 5, isPaused: true, stats: { breaksToday: 3, focusTime: 500 } }
    const next = reset(s)
    expect(next.phase).toBe('focus')
    expect(next.remaining).toBe(FOCUS_DURATION)
    expect(next.isPaused).toBe(false)
  })

  it('preserves today\'s stats on reset', () => {
    const s = { ...createInitialState(), stats: { breaksToday: 3, focusTime: 500 } }
    const next = reset(s)
    expect(next.stats.breaksToday).toBe(3)
    expect(next.stats.focusTime).toBe(500)
  })
})
