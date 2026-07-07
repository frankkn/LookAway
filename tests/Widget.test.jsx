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
  onUpdateStatus: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  resetTimer: vi.fn(),
  startBreak: vi.fn(),
  startFocus: vi.fn(),
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
  mockAPI.onUpdateStatus.mockReturnValue(() => {})
  Object.defineProperty(window, 'electronAPI', {
    value: mockAPI,
    writable: true,
    configurable: true,
  })
})

// Push a state snapshot into the widget via the onTimerTick callback.
function renderWidget() {
  let tickCb = null
  let updateCb = null
  mockAPI.onTimerTick.mockImplementation(cb => {
    tickCb = cb
    return () => {}
  })
  mockAPI.onUpdateStatus.mockImplementation(cb => {
    updateCb = cb
    return () => {}
  })
  render(<Widget />)
  // After render(), useEffect has flushed (RTL wraps in act), so tickCb is set.
  return {
    push: s => act(() => { tickCb(s) }),
    pushUpdate: s => act(() => { updateCb(s) }),
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
const done = {
  phase: 'done', remaining: 20 * 60, isPaused: false,
  stats: { breaksToday: 1, focusTime: 1200 },
}

// ── display tests ────────────────────────────────────────────────────────────
describe('Widget display', () => {
  it('shows upcoming focus time and 準備開始 in idle phase', () => {
    renderWidget()
    // DEFAULT_STATE is idle/20:00, no push needed
    expect(screen.getByText('20:00')).toBeInTheDocument()
    expect(screen.getByText('準備開始')).toBeInTheDocument()
  })

  it('shows M:SS countdown in focus phase', () => {
    const { push } = renderWidget()
    push(focus)
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

  it('shows upcoming focus time and 休息完成 in done phase', () => {
    const { push } = renderWidget()
    push(done)
    expect(screen.getByText('20:00')).toBeInTheDocument()
    expect(screen.getByText('休息完成')).toBeInTheDocument()
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
  it('shows "▶ 開始工作" button in idle phase and calls startFocus on click', async () => {
    renderWidget() // DEFAULT_STATE is idle
    await userEvent.click(screen.getByText('▶ 開始工作'))
    expect(mockAPI.startFocus).toHaveBeenCalledOnce()
  })

  it('shows Pause button in focus phase', () => {
    const { push } = renderWidget()
    push(focus)
    expect(screen.getByText('⏸ Pause')).toBeInTheDocument()
  })

  it('shows Resume button when paused', () => {
    const { push } = renderWidget()
    push(focusPaused)
    expect(screen.getByText('▶ Resume')).toBeInTheDocument()
  })

  it('shows Reset button in focus phase', () => {
    const { push } = renderWidget()
    push(focus)
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
    const { push } = renderWidget()
    push(focus)
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

  it('shows "▶ 繼續工作" button in done phase and calls startFocus on click', async () => {
    const { push } = renderWidget()
    push(done)
    await userEvent.click(screen.getByText('▶ 繼續工作'))
    expect(mockAPI.startFocus).toHaveBeenCalledOnce()
  })
})

// ── update progress strip ────────────────────────────────────────────────────
describe('Widget update strip', () => {
  it('is hidden by default', () => {
    renderWidget()
    expect(screen.queryByText(/下載中/)).not.toBeInTheDocument()
  })

  it('shows download progress with version and percent', () => {
    const { pushUpdate } = renderWidget()
    pushUpdate({ state: 'downloading', version: '1.3.0', percent: 0 })
    pushUpdate({ state: 'downloading', percent: 45.4, bytesPerSecond: 3.2 * 1024 * 1024 })
    expect(screen.getByText(/更新 v1\.3\.0 下載中 45%/)).toBeInTheDocument()
    expect(screen.getByText(/3\.2 MB\/s/)).toBeInTheDocument()
  })

  it('shows ready message when the download completes', () => {
    const { pushUpdate } = renderWidget()
    pushUpdate({ state: 'downloading', version: '1.3.0', percent: 80 })
    pushUpdate({ state: 'ready', version: '1.3.0' })
    expect(screen.getByText(/v1\.3\.0 已就緒/)).toBeInTheDocument()
  })

  it('disappears when the status returns to none', () => {
    const { pushUpdate } = renderWidget()
    pushUpdate({ state: 'downloading', version: '1.3.0', percent: 10 })
    pushUpdate({ state: 'none' })
    expect(screen.queryByText(/下載中/)).not.toBeInTheDocument()
  })
})
