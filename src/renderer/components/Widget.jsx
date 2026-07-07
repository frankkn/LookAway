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
  phase: 'idle',
  remaining: FOCUS_DURATION,
  isPaused: false,
  stats: { breaksToday: 0, focusTime: 0 },
}

const ORANGE = '#ff6b35'
const BLUE = '#4fc3f7'

export default function Widget() {
  const [ts, setTs] = useState(DEFAULT_STATE)
  const [update, setUpdate] = useState(null) // { state, version, percent, bytesPerSecond }

  useEffect(() => {
    window.electronAPI?.getTimerState().then(s => s && setTs(s))
    const cleanup = window.electronAPI?.onTimerTick(setTs)
    return () => typeof cleanup === 'function' && cleanup()
  }, [])

  useEffect(() => {
    const cleanup = window.electronAPI?.onUpdateStatus?.(s => {
      // merge partial events (progress has no version) into the last status
      setUpdate(prev => (s.state === 'none' ? null : { ...prev, ...s }))
    })
    return () => typeof cleanup === 'function' && cleanup()
  }, [])

  // Scale the whole 280×360 canvas proportionally to fill the window
  useEffect(() => {
    const BASE_W = 280
    const BASE_H = 360
    const update = () => {
      const k = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H)
      document.documentElement.style.setProperty('--scale', String(k))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const { phase, remaining, isPaused, stats } = ts
  // Durations come from the main process (user-configurable); fall back to defaults
  const focusDur = ts.focusDuration || FOCUS_DURATION
  const breakDur = ts.breakDuration || BREAK_DURATION

  // Per-phase display config
  let arcColor = ORANGE
  let progress = 1
  let bigText = ''
  let subText = ''

  if (phase === 'idle') {
    arcColor = ORANGE
    progress = 1
    bigText = fmt(focusDur)
    subText = '準備開始'
  } else if (phase === 'focus') {
    arcColor = ORANGE
    progress = remaining / focusDur
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
    bigText = String(breakDur)
    subText = '秒 · 準備護眼'
  } else if (phase === 'break') {
    arcColor = BLUE
    progress = remaining / breakDur
    bigText = String(remaining)
    subText = '看向遠方'
  } else if (phase === 'done') {
    arcColor = ORANGE
    progress = 1
    bigText = fmt(focusDur)
    subText = '休息完成'
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
            title="Settings"
            onClick={() => window.electronAPI?.openSettings()}
          >⚙</button>
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

      <UpdateStrip update={update} />
    </div>
  )
}

// Slim overlay along the widget's bottom edge while an update downloads
function UpdateStrip({ update }) {
  if (!update) return null
  if (update.state === 'downloading') {
    const pct = Math.round(update.percent || 0)
    const speed = update.bytesPerSecond
      ? ` · ${(update.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
      : ''
    return (
      <div className="update-strip">
        <div className="update-strip-fill" style={{ width: `${pct}%` }} />
        <span>⬇ 更新{update.version ? ` v${update.version}` : ''} 下載中 {pct}%{speed}</span>
      </div>
    )
  }
  if (update.state === 'ready') {
    return (
      <div className="update-strip update-strip-ready">
        <span>✓ 更新{update.version ? ` v${update.version}` : ''} 已就緒,重啟後套用</span>
      </div>
    )
  }
  return null
}

function PhaseBadge({ phase, isPaused }) {
  let cls = 'phase-badge'
  let text = ''
  if (phase === 'idle') {
    text = '準備好就開始吧'
  } else if (phase === 'focus') {
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
  } else if (phase === 'done') {
    cls += ' phase-break'
    text = '✓ 休息完成,準備好就繼續'
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

  if (phase === 'idle' || phase === 'done') {
    return (
      <button
        className="btn-ctrl btn-start"
        onClick={() => api?.startFocus()}
      >
        {phase === 'idle' ? '▶ 開始工作' : '▶ 繼續工作'}
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
