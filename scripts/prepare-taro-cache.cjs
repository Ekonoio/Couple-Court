// Taro 4 initializes this per-user cache even when global plugins are disabled.
// Preserve all existing user configuration and never change HOME.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const directory = path.join(os.homedir(), '.taro4.0')
fs.mkdirSync(directory, { recursive: true })
const configFile = path.join(directory, 'index.json')
if (!fs.existsSync(configFile)) {
  fs.writeFileSync(configFile, '{}\n', { flag: 'wx', mode: 0o600 })
}
console.log('Taro user cache is initialized; existing settings preserved.')
