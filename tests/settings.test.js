import { describe, it, expect } from 'vitest'
import { DEFAULTS, LIMITS, sanitize } from '../src/main/settings.js'

describe('sanitize', () => {
  it('returns defaults for an empty object', () => {
    expect(sanitize({})).toEqual(DEFAULTS)
  })

  it('keeps in-range values as-is', () => {
    const s = sanitize({ widgetWidth: 400, focusDuration: 1500, reminderFontSize: 20 })
    expect(s.widgetWidth).toBe(400)
    expect(s.focusDuration).toBe(1500)
    expect(s.reminderFontSize).toBe(20)
  })

  it('clamps out-of-range numbers into LIMITS', () => {
    const s = sanitize({
      widgetWidth: 99999,
      reminderFontSize: 1,
      focusDuration: 0,
      breakDuration: -5,
    })
    expect(s.widgetWidth).toBe(LIMITS.widgetWidth.max)
    expect(s.reminderFontSize).toBe(LIMITS.reminderFontSize.min)
    expect(s.focusDuration).toBe(LIMITS.focusDuration.min)
    expect(s.breakDuration).toBe(LIMITS.breakDuration.min)
  })

  it('falls back to defaults for wrong types (hand-edited settings.json)', () => {
    const s = sanitize({
      widgetWidth: 'abc',
      reminderFontSize: "16px'; alert(1); '",
      focusDuration: null,
      breakDuration: NaN,
    })
    expect(s.widgetWidth).toBe(DEFAULTS.widgetWidth)
    expect(s.reminderFontSize).toBe(DEFAULTS.reminderFontSize)
    expect(s.focusDuration).toBe(DEFAULTS.focusDuration)
    expect(s.breakDuration).toBe(DEFAULTS.breakDuration)
  })

  it('clamps widgetScale via the widgetScalePct limits', () => {
    expect(sanitize({ widgetScale: 10 }).widgetScale).toBe(LIMITS.widgetScalePct.max / 100)
    expect(sanitize({ widgetScale: 0.1 }).widgetScale).toBe(LIMITS.widgetScalePct.min / 100)
    expect(sanitize({ widgetScale: 'big' }).widgetScale).toBe(DEFAULTS.widgetScale)
  })

  it('keeps a valid widget position and rounds it', () => {
    const s = sanitize({ widgetX: 100.6, widgetY: -50.2 })
    expect(s.widgetX).toBe(101)
    expect(s.widgetY).toBe(-50)
  })

  it('nulls a non-numeric widget position', () => {
    const s = sanitize({ widgetX: '100', widgetY: Infinity })
    expect(s.widgetX).toBeNull()
    expect(s.widgetY).toBeNull()
  })

  it('drops unknown keys', () => {
    const s = sanitize({ focusH: 2, evil: 'x' })
    expect(s).not.toHaveProperty('focusH')
    expect(s).not.toHaveProperty('evil')
  })
})
