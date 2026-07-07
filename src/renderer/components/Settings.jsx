import React, { useState, useEffect } from 'react'
// Single source of truth for value ranges, shared with the main process
// (src/main/settings.js), which clamps everything again on load/save.
import LIMITS from '../../shared/limits.json'

function NumInput({ value, onChange, min, max, unit, width }) {
  // Local text state so the user can type freely; clamp only on blur / Enter.
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  const commit = () => {
    let v = Number(text)
    if (isNaN(v) || text === '') v = value
    v = Math.max(min, Math.min(max, v))
    setText(String(v))
    onChange(v)
  }

  return (
    <span className="num-wrap">
      <input
        type="number"
        className="num-input"
        style={width ? { width } : undefined}
        value={text}
        min={min}
        max={max}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
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
  const [previewingWidget, setPreviewingWidget] = useState(false)
  const [previewingReminder, setPreviewingReminder] = useState(false)

  useEffect(() => {
    window.electronAPI?.getSettings().then(s => {
      if (!s) return
      const f = s.focusDuration
      const b = s.breakDuration
      setForm({
        ...s,
        focusH: Math.floor(f / 3600),
        focusM: Math.floor((f % 3600) / 60),
        focusS: f % 60,
        breakM: Math.floor(b / 60),
        breakS: b % 60,
        widgetScalePct: Math.round((s.widgetScale ?? 1) * 100),
      })
    })
  }, [])

  // Widget preview: apply size/zoom to the real widget only while toggled on
  useEffect(() => {
    if (!form || !previewingWidget) return
    window.electronAPI?.previewWidget({
      widgetWidth: form.widgetWidth,
      widgetHeight: form.widgetHeight,
      widgetScale: form.widgetScalePct / 100,
    })
  }, [previewingWidget, form?.widgetWidth, form?.widgetHeight, form?.widgetScalePct])

  // Reminder preview: show the reminder window only while toggled on
  useEffect(() => {
    if (!form || !previewingReminder) return
    window.electronAPI?.previewReminder({
      reminderWidth: form.reminderWidth,
      reminderHeight: form.reminderHeight,
      reminderFontSize: form.reminderFontSize,
    })
  }, [previewingReminder, form?.reminderWidth, form?.reminderHeight, form?.reminderFontSize])

  // If the preview was closed via its own X, flip the toggle back off
  useEffect(() => {
    const cleanup = window.electronAPI?.onReminderPreviewEnded?.(() => setPreviewingReminder(false))
    return () => typeof cleanup === 'function' && cleanup()
  }, [])

  if (!form) return <div className="settings-loading">載入中…</div>

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleWidgetPreview = () => {
    setPreviewingWidget(p => {
      const next = !p
      if (!next) window.electronAPI?.stopWidgetPreview()
      return next
    })
  }

  const toggleReminderPreview = () => {
    setPreviewingReminder(p => {
      const next = !p
      if (!next) window.electronAPI?.stopReminderPreview()
      return next
    })
  }

  const handleSave = () => {
    const { focusH, focusM, focusS, breakM, breakS, widgetScalePct, ...rest } = form
    const focusDuration = focusH * 3600 + focusM * 60 + focusS
    const breakDuration = breakM * 60 + breakS
    window.electronAPI?.saveSettings({
      ...rest,
      widgetScale: widgetScalePct / 100,
      // Guard against an all-zero entry that would break the countdown
      focusDuration: Math.max(5, focusDuration),
      breakDuration: Math.max(5, breakDuration),
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
            <NumInput value={form.focusH} onChange={v => set('focusH', v)}
              min={0} max={8}  unit="時" width={44} />
            <NumInput value={form.focusM} onChange={v => set('focusM', v)}
              min={0} max={59} unit="分" width={44} />
            <NumInput value={form.focusS} onChange={v => set('focusS', v)}
              min={0} max={59} unit="秒" width={44} />
          </Row>
          <Row label="休息時長">
            <NumInput value={form.breakM} onChange={v => set('breakM', v)}
              min={0} max={59} unit="分" width={44} />
            <NumInput value={form.breakS} onChange={v => set('breakS', v)}
              min={0} max={59} unit="秒" width={44} />
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
          <Row label="整體縮放">
            <NumInput value={form.widgetScalePct} onChange={v => set('widgetScalePct', v)}
              min={LIMITS.widgetScalePct.min} max={LIMITS.widgetScalePct.max} unit="%" />
          </Row>
          <button
            className={`btn-preview ${previewingWidget ? 'is-on' : ''}`}
            onClick={toggleWidgetPreview}
          >
            {previewingWidget ? '✕ 停止預覽' : '👁 預覽主視窗'}
          </button>
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
          <button
            className={`btn-preview ${previewingReminder ? 'is-on' : ''}`}
            onClick={toggleReminderPreview}
          >
            {previewingReminder ? '✕ 隱藏預覽' : '👁 預覽提醒視窗'}
          </button>
        </section>

      </div>

      <div className="settings-footer no-drag">
        <button className="btn-cancel" onClick={handleCancel}>取消</button>
        <button className="btn-save" onClick={handleSave}>儲存</button>
      </div>
    </div>
  )
}
