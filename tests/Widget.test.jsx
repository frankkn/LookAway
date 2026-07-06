import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Widget from '../src/renderer/components/Widget.jsx'

// ── mock window.electronAPI ──────────────────────────────────────────────────
const mockAPI = {
  getTimerState: vi.fn(),
  getSettings: vi.fn(),
  onTimerTick: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  resetTimer: vi.fn(),
  startBreak: vi.fn(),
  skipBreak: vi.fn(),
  minimizeWindow: vi.fn(),
  closeWindow: vi.fn(),
  openSettings: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAPI.getTimerState.mockResolvedValue(null) // don't override DEFAULT_STATE
  mockAPI.getSettings.mockResolvedValue(null)
  mockAPI.onTimerTick.mockReturnValue(() => {})
  Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
  })
})

// Push a state snapshot into the widget via the onTimerTick callback.
function renderWidget() {
  let tickCb = null
  mockAPI.onTimerTick.mockImplementation(cb => {
    tickCb = cb
    return () => {}
  })
  render(<Widget />)
  // After render(), useEffect has flushed (RTL wraps in act), so tickCb is set.
  return {
    push: s => act(() => { tickCb(s) }),
  }
}

// ── state fixtures ───────────────────────────────────────────────────────────
const focus = {
  phase: 'focus', remaining: 20 * 60, isPaused: false,
  stats: { breaksToday: 0, focusTime: 0 },
}
const focusPaused = { ...focus, isPaused: true }
const reminder = {
  phase: 'reminder', remaining: 20, isPaused: false,
  stats: { breaksToday: 0, focusTime: 1200 },
}
const ready = {
  phase: 'ready', remaining: 20, isPaused: false,
  stats: { breaksToday: 0, focusTime: 600 },
}
const breakPhase = {
  phase: 'break', remaining: 20, isPaused: false,
  stats: { breaksToday: 1, focusTime: 300 },
}

// ── display tests ────────────────────────────────────────────────────────────
describe('Widget display', () => {
  it('shows M:SS countdown in focus phase', () => {
    renderWidget()
    // DEFAULT_STATE is focus/20:00, no push needed
    expect(screen.getByText('20:00')).toBeInTheDocument()
    expect(screen.getByText('until break')).toBeInTheDocument()
  })

  it('shows eye emoji and 該休息了 in reminder phase', () => {
    const { push } = renderWidget()
    push(reminder)
    expect(screen.getByText('👁')).toBeInTheDocument()
    expect(screen.getByText('該休息了')).toBeInTheDocument()
  })

  it('shows "20" and 秒 · 準備護眼 in ready phase', () => {
    const { push } = renderWidget()
    push(ready)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('秒 · 準備護眼')).toBeInTheDocument()
  })

  it('shows second countdown and 看向遠方 in break phase', () => {
    const { push } = renderWidget()
    push(breakPhase)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('看向遠方')).toBeInTheDocument()
  })
})

// ── stats display ────────────────────────────────────────────────────────────
describe('Widget stats', () => {
  it('displays breaksToday count', () => {
    const { push } = renderWidget()
    push({ ...focus, stats: { breaksToday: 5, focusTime: 0 } })
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('displays focusTime in minutes', () => {
    const { push } = renderWidget()
    push({ ...focus, stats: { breaksToday: 0, focusTime: 300 } })
    expect(screen.getByText('5m')).toBeInTheDocument()
  })

  it('displays focusTime in hours and minutes when ≥ 1 hour', () => {
    const { push } = renderWidget()
    push({ ...focus, stats: { breaksToday: 0, focusTime: 3660 } })
    expect(screen.getByText('1h 1m')).toBeInTheDocument()
  })
})

// ── controls ─────────────────────────────────────────────────────────────────
describe('Widget controls', () => {
  it('shows Pause button in focus phase', () => {
    renderWidget()
    expect(screen.getByText('⏸ Pause')).toBeInTheDocument()
  })

  it('shows Resume button when paused', () => {
    const { push } = renderWidget()
    push(focusPaused)
    expect(screen.getByText('▶ Resume')).toBeInTheDocument()
  })

  it('shows Reset button in focus phase', () => {
    renderWidget()
    expect(screen.getByText('↺ Reset')).toBeInTheDocument()
  })

  it('shows "▶ 開始計時休息" button in ready phase', () => {
    const { push } = renderWidget()
    push(ready)
    expect(screen.getByText('▶ 開始計時休息')).toBeInTheDocument()
  })

  it('shows "Skip 跳過" button in break phase', () => {
    const { push } = renderWidget()
    push(breakPhase)
    expect(screen.getByText('Skip 跳過')).toBeInTheDocument()
  })

  it('calls pauseTimer when Pause is clicked', async () => {
    renderWidget()
    await userEvent.click(screen.getByText('⏸ Pause'))
    expect(mockAPI.pauseTimer).toHaveBeenCalledOnce()
  })

  it('calls resumeTimer when Resume is clicked', async () => {
    const { push } = renderWidget()
    push(focusPaused)
    await userEvent.click(screen.getByText('▶ Resume'))
    expect(mockAPI.resumeTimer).toHaveBeenCalledOnce()
  })

  it('calls startBreak when 開始計時休息 is clicked', async () => {
    const { push } = renderWidget()
    push(ready)
    await userEvent.click(screen.getByText('▶ 開始計時休息'))
    expect(mockAPI.startBreak).toHaveBeenCalledOnce()
  })

  it('calls skipBreak when Skip is clicked', async () => {
    const { push } = renderWidget()
    push(breakPhase)
    await userEvent.click(screen.getByText('Skip 跳過'))
    expect(mockAPI.skipBreak).toHaveBeenCalledOnce()
  })
})
