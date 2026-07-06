import React, { useState, useEffect } from 'react'

const FOCUS_DEFAULT = 20 * 60
const BREAK_DEFAULT = 20

function fmtFocus(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const parts = []
  if (h) parts.push(`${h} 小時`)
  if (m) parts.push(`${m} 分鐘`)
  if (s && !h) parts.push(`${s} 秒`)
  return parts.join(' ') || `${secs} 秒`
}

function fmtBreak(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m && s) return `${m} 分 ${s} 秒`
  if (m) return `${m} 分鐘`
  return `${s} 秒`
}

export default function Reminder() {
  const [focusDur, setFocusDur] = useState(FOCUS_DEFAULT)
  const [breakDur, setBreakDur] = useState(BREAK_DEFAULT)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    const apply = s => {
      if (!s) return
      if (s.focusDuration) setFocusDur(s.focusDuration)
      if (s.breakDuration) setBreakDur(s.breakDuration)
    }
    window.electronAPI?.getTimerState().then(apply)
    const cleanup = window.electronAPI?.onTimerTick(apply)
    const cleanupPreview = window.electronAPI?.onReminderPreviewMode?.(setPreview)
    return () => {
      if (typeof cleanup === 'function') cleanup()
      if (typeof cleanupPreview === 'function') cleanupPreview()
    }
  }, [])

  return (
    <div className="reminder">
      <div className="reminder-card">
        <div className="reminder-drag-handle" />
        {preview && (
          <button
            className="reminder-close"
            title="關閉預覽"
            onClick={() => window.electronAPI?.closeReminderPreview()}
          >×</button>
        )}
        <div className="reminder-eye">👁</div>
        <h1 className="reminder-title">該讓眼睛休息一下了</h1>
        <p className="reminder-sub">{`你已經專注 ${fmtFocus(focusDur)}囉`}</p>

        <p className="reminder-body">
          望向約 <b>6 公尺(20 呎)</b> 外的地方，放鬆 {fmtBreak(breakDur)}
        </p>

        <div className="reminder-hint">
          按下後，到右下角點
          <span className="reminder-btn-name">▶ 開始計時休息</span>
        </div>

        <button
          className="reminder-ok"
          autoFocus
          onClick={() => window.electronAPI?.acknowledgeBreak()}
        >
          好,我知道了
        </button>
      </div>
    </div>
  )
}
