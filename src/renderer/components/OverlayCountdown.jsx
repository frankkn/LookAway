import React, { useState, useEffect } from 'react'
import ArcProgress from './ArcProgress.jsx'

const BREAK_DURATION = 20

const DEFAULT_STATE = {
  phase: 'break',
  remaining: BREAK_DURATION,
  isPaused: false,
  stats: { breaksToday: 0, focusTime: 0 },
}

export default function OverlayCountdown() {
  const [ts, setTs] = useState(DEFAULT_STATE)

  useEffect(() => {
    window.electronAPI?.getTimerState().then(s => s && setTs(s))
    const cleanup = window.electronAPI?.onTimerTick(setTs)
    return () => typeof cleanup === 'function' && cleanup()
  }, [])

  const { remaining, stats } = ts
  const progress = remaining / BREAK_DURATION
  const breakNum = (stats.breaksToday || 0) + 1

  return (
    <div className="overlay">
      <div className="overlay-card">
        <p className="overlay-eyebrow">Break #{breakNum} today</p>
        <h1 className="overlay-heading">Time to look away</h1>
        <p className="overlay-sub">Focus on something ~20 feet (6 m) away</p>

        <div className="overlay-arc">
          <ArcProgress
            progress={progress}
            color="#4fc3f7"
            trackColor="rgba(79,195,247,0.15)"
            strokeWidth={14}
            size={280}
          >
            <div className="ov-timer">
              <span className="ov-secs">{remaining}</span>
              <span className="ov-unit">seconds</span>
            </div>
          </ArcProgress>
        </div>

        <p className="overlay-tip">Blink, breathe, and let your eyes rest</p>

        <button
          className="skip-btn"
          onClick={() => window.electronAPI?.skipBreak()}
        >
          Skip this break
        </button>
      </div>
    </div>
  )
}
