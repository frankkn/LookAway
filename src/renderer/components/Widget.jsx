import React, { useState, useEffect } from 'react'
import ArcProgress from './ArcProgress.jsx'

const FOCUS_DURATION = 20 * 60
const BREAK_DURATION = 20

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtFocus(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const DEFAULT_STATE = {
  phase: 'focus',
  remaining: FOCUS_DURATION,
  isPaused: false,
  stats: { breaksToday: 0, focusTime: 0 },
}

export default function Widget() {
  const [ts, setTs] = useState(DEFAULT_STATE)

  useEffect(() => {
    window.electronAPI?.getTimerState().then(s => s && setTs(s))
    const cleanup = window.electronAPI?.onTimerTick(setTs)
    return () => typeof cleanup === 'function' && cleanup()
  }, [])

  const { phase, remaining, isPaused, stats } = ts
  const isFocus = phase === 'focus'
  const progress = remaining / (isFocus ? FOCUS_DURATION : BREAK_DURATION)
  const arcColor = isFocus ? '#ff6b35' : '#4fc3f7'

  return (
    <div className="widget">
      {/* Drag handle / header */}
      <div className="widget-header drag">
        <div className="header-dot" style={{ background: arcColor }} />
        <span className="app-title">Look Away</span>
        <div className="header-btns no-drag">
          <button
            className="hbtn"
            title="Hide to tray"
            onClick={() => window.electronAPI?.minimizeWindow()}
          >−</button>
          <button
            className="hbtn hbtn-close"
            title="Quit"
            onClick={() => window.electronAPI?.closeWindow()}
          >×</button>
        </div>
      </div>

      {/* Arc timer */}
      <div className="arc-wrap">
        <ArcProgress progress={progress} color={arcColor} size={174}>
          <div className="timer-center">
            <span className="timer-big">{isFocus ? fmt(remaining) : remaining}</span>
            <span className="timer-sub">
              {isFocus ? 'until break' : 'look away'}
            </span>
          </div>
        </ArcProgress>
      </div>

      {/* Phase indicator */}
      <div className={`phase-badge ${isFocus ? '' : 'phase-break'}`}>
        {isFocus
          ? isPaused ? '⏸ Paused' : '● Focusing'
          : '👁 Break time — look 20 ft away'}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat">
          <span className="stat-val">{stats.breaksToday}</span>
          <span className="stat-lbl">breaks today</span>
        </div>
        <div className="stat-sep" />
        <div className="stat">
          <span className="stat-val">{fmtFocus(stats.focusTime)}</span>
          <span className="stat-lbl">focus time</span>
        </div>
      </div>

      {/* Controls */}
      <div className="controls no-drag">
        <button
          className={`btn-ctrl ${isPaused ? 'btn-resume' : ''}`}
          onClick={() => isPaused
            ? window.electronAPI?.resumeTimer()
            : window.electronAPI?.pauseTimer()
          }
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className="btn-ctrl btn-reset"
          onClick={() => window.electronAPI?.resetTimer()}
        >
          ↺ Reset
        </button>
      </div>
    </div>
  )
}
