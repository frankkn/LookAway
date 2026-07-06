const path = require('path')
const fs = require('fs')

let _app = null

const DEFAULTS = {
  widgetWidth: 280,
  widgetHeight: 360,
  widgetFontSize: 14,
  reminderWidth: 460,
  reminderHeight: 360,
  reminderFontSize: 16,
  focusDuration: 20 * 60,
  breakDuration: 20,
}

function init(app) {
  _app = app
}

function getPath() {
  return path.join(_app.getPath('userData'), 'settings.json')
}

function load() {
  try {
    const raw = fs.readFileSync(getPath(), 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(data) {
  const merged = { ...DEFAULTS, ...data }
  fs.writeFileSync(getPath(), JSON.stringify(merged, null, 2))
  return merged
}

module.exports = { DEFAULTS, init, load, save }
