'use strict'
delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')
const http = require('http')
const electronPath = require('electron')

function waitForVite(port, attempts = 40) {
  return new Promise((resolve, reject) => {
    const try_ = (n) => {
      http.get(`http://localhost:${port}/`, res => {
        res.resume()
        resolve()
      }).on('error', () => {
        if (n <= 0) return reject(new Error('Vite did not start in time'))
        setTimeout(() => try_(n - 1), 500)
      })
    }
    try_(attempts)
  })
}

waitForVite(5173)
  .then(() => {
    const child = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env })
    child.on('close', code => process.exit(code ?? 0))
  })
  .catch(err => { console.error('[electron]', err.message); process.exit(1) })
