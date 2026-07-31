#!/usr/bin/env node
// Simulates an RFID reader tapping a card, for development without real
// hardware. Talks to the same POST /rfid/tap endpoint a real reader hits,
// using device-key auth (not Firebase auth — readers aren't logged-in users).
//
// Usage:
//   node simulate-tap.mjs --device-id <id> --device-key <key> --uid <rfidUID> [--api http://localhost:4100/api/v1]

function parseArgs(argv) {
  const opts = { api: 'http://localhost:4100/api/v1' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--device-id') opts.deviceId = argv[++i]
    else if (a === '--device-key') opts.deviceKey = argv[++i]
    else if (a === '--uid') opts.uid = argv[++i]
    else if (a === '--api') opts.api = argv[++i]
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
if (!opts.deviceId || !opts.deviceKey || !opts.uid) {
  console.error('Usage: node simulate-tap.mjs --device-id <id> --device-key <key> --uid <rfidUID> [--api <baseUrl>]')
  process.exit(1)
}

const res = await fetch(`${opts.api}/rfid/tap`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Id': opts.deviceId,
    'X-Device-Key': opts.deviceKey,
  },
  body: JSON.stringify({ rfidUID: opts.uid }),
})

const body = await res.json().catch(() => ({}))
console.log(`HTTP ${res.status}`)
console.log(JSON.stringify(body, null, 2))
process.exit(res.ok ? 0 : 1)
