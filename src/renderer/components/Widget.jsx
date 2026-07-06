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

const ORANGE = '#ff6b35'
const BLUE = '#4fc3f7'

export default function Widget() {
  const [ts, setTs] = useState(DEFAULT_STATE)

  useEffect(() => {
    window.electronAPI?.getTimerState().then(s => s && setTs(s))
    const cleanup = window.electronAPI?.onTimerTick(setTs)
    return () => typeof cleanup === 'function' && cleanup()
  }, [])

  const { phase, remaining, isPaused, stats } = ts

  // Per-phase display config
  let arcColor = ORANGE
  let progress = 1
  let bigText = ''
  let subText = ''

  if (phase === 'focus') {
    arcColor = ORANGE
    progress = remaining / FOCUS_DURATION
    bigText = fmt(remaining)
    subText = 'until break'
  } else if (phase === 'reminder') {
    arcColor = ORANGE
    progress = 1
    bigText = '👁'
    subText = '該休息了'
  } else if (phase === 'ready') {
    arcColor = BLUE
    progress = 1
    bigText = '20'
    subText = '秒 · 準備護眼'
  } else if (phase === 'break') {
    arcColor = BLUE
    progress = remaining / BREAK_DURATION
    bigText = String(remaining)
    subText = '看向遠方'
  }

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
            <span className={`timer-big ${phase === 'reminder' ? 'timer-emoji' : ''}`}>
              {bigText}
            </span>
            <span className="timer-sub">{subText}</span>
          </div>
        </ArcProgress>
      </div>

      {/* Phase indicator */}
      <PhaseBadge phase={phase} isPaused={isPaused} />

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

      {/* Controls — vary by phase */}
      <div className="controls no-drag">
        <Controls phase={phase} isPaused={isPaused} />
      </div>
    </div>
  )
}

function PhaseBadge({ phase, isPaused }) {
  let cls = 'phase-badge'
  let text = ''
  if (phase === 'focus') {
    text = isPaused ? '⏸ Paused' : '● Focusing'
  } else if (phase === 'reminder') {
    cls += ' phase-break'
    text = '該休息了 — 請看提醒視窗'
  } else if (phase === 'ready') {
    cls += ' phase-break'
    text = '準備好了就開始吧'
  } else if (phase === 'break') {
    cls += ' phase-break'
    text = '👁 看向 20 呎(約 6 公尺)外'
  }
  return <div className={cls}>{text}</div>
}

function Controls({ phase, isPaused }) {
  const api = window.electronAPI

  if (phase === 'reminder') {
    return (
      <div className="ctrl-hint">請按提醒視窗的「好,我知道了」</div>
    )
  }

  if (phase === 'ready') {
    return (
      <button
        className="btn-ctrl btn-start"
        onClick={() => api?.startBreak()}
      >
        ▶ 開始計時休息
      </button>
    )
  }

  if (phase === 'break') {
    return (
      <button
        className="btn-ctrl btn-skip"
        onClick={() => api?.skipBreak()}
      >
        Skip 跳過
      </button>
    )
  }

  // focus
  return (
    <>
      <button
        className={`btn-ctrl ${isPaused ? 'btn-resume' : ''}`}
        onClick={() => isPaused ? api?.resumeTimer() : api?.pauseTimer()}
      >
        {isPaused ? '▶ Resume' : '⏸ Pause'}
      </button>
      <button
        className="btn-ctrl btn-reset"
        onClick={() => api?.resetTimer()}
      >
        ↺ Reset
      </button>
    </>
  )
}
