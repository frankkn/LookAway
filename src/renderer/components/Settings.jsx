import React, { useState, useEffect } from 'react'

const LIMITS = {
  widgetWidth:      { min: 220, max: 500 },
  widgetHeight:     { min: 300, max: 600 },
  widgetFontSize:   { min: 10,  max: 26  },
  reminderWidth:    { min: 320, max: 700 },
  reminderHeight:   { min: 260, max: 600 },
  reminderFontSize: { min: 10,  max: 28  },
  focusMins:        { min: 1,   max: 60  },
  breakSecs:        { min: 5,   max: 300 },
}

function NumInput({ value, onChange, min, max, unit }) {
  return (
    <span className="num-wrap">
      <input
        type="number"
        className="num-input"
        value={value}
        min={min}
        max={max}
        onChange={e => {
          const v = Number(e.target.value)
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
        }}
      />
      {unit && <span className="num-unit">{unit}</span>}
    </span>
  )
}

function Row({ label, children }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="setting-ctrl">{children}</div>
    </div>
  )
}

export default function Settings() {
  const [form, setForm] = useState(null)

  useEffect(() => {
    window.electronAPI?.getSettings().then(s => {
      if (!s) return
      setForm({ ...s, focusMins: Math.round(s.focusDuration / 60), breakSecs: s.breakDuration })
    })
  }, [])

  if (!form) return <div className="settings-loading">載入中…</div>

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = () => {
    window.electronAPI?.saveSettings({
      ...form,
      focusDuration: form.focusMins * 60,
      breakDuration: form.breakSecs,
    })
  }

  const handleCancel = () => window.electronAPI?.closeWindow()

  return (
    <div className="settings">
      <div className="settings-header drag">
        <span className="settings-title">⚙ 設定</span>
      </div>

      <div className="settings-body no-drag">

        <section className="setting-section">
          <h2 className="section-title">計時</h2>
          <Row label="工作時長">
            <NumInput value={form.focusMins} onChange={v => set('focusMins', v)}
              min={LIMITS.focusMins.min} max={LIMITS.focusMins.max} unit="分鐘" />
          </Row>
          <Row label="休息時長">
            <NumInput value={form.breakSecs} onChange={v => set('breakSecs', v)}
              min={LIMITS.breakSecs.min} max={LIMITS.breakSecs.max} unit="秒" />
          </Row>
        </section>

        <section className="setting-section">
          <h2 className="section-title">主視窗（右下角）</h2>
          <Row label="視窗大小">
            <NumInput value={form.widgetWidth} onChange={v => set('widgetWidth', v)}
              min={LIMITS.widgetWidth.min} max={LIMITS.widgetWidth.max} />
            <span className="separator">×</span>
            <NumInput value={form.widgetHeight} onChange={v => set('widgetHeight', v)}
              min={LIMITS.widgetHeight.min} max={LIMITS.widgetHeight.max} unit="px" />
          </Row>
          <Row label="字體大小">
            <NumInput value={form.widgetFontSize} onChange={v => set('widgetFontSize', v)}
              min={LIMITS.widgetFontSize.min} max={LIMITS.widgetFontSize.max} unit="px" />
          </Row>
        </section>

        <section className="setting-section">
          <h2 className="section-title">休息提醒視窗</h2>
          <Row label="視窗大小">
            <NumInput value={form.reminderWidth} onChange={v => set('reminderWidth', v)}
              min={LIMITS.reminderWidth.min} max={LIMITS.reminderWidth.max} />
            <span className="separator">×</span>
            <NumInput value={form.reminderHeight} onChange={v => set('reminderHeight', v)}
              min={LIMITS.reminderHeight.min} max={LIMITS.reminderHeight.max} unit="px" />
          </Row>
          <Row label="字體大小">
            <NumInput value={form.reminderFontSize} onChange={v => set('reminderFontSize', v)}
              min={LIMITS.reminderFontSize.min} max={LIMITS.reminderFontSize.max} unit="px" />
          </Row>
        </section>

      </div>

      <div className="settings-footer no-drag">
        <button className="btn-cancel" onClick={handleCancel}>取消</button>
        <button className="btn-save" onClick={handleSave}>儲存</button>
      </div>
    </div>
  )
}
