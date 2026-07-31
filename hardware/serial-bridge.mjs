#!/usr/bin/env node
// Bridges a USB-tethered RFID reader to the real backend. The board (flashed
// with rfid-serial-only/rfid_serial_only.ino) just reads cards and prints
// "UID:<hex>" over Serial — no WiFi on the board at all. This script watches
// that Serial port and does the HTTP POST to /rfid/tap itself, using the
// same device-key auth a standalone WiFi reader would use.
//
// Usage:
//   node serial-bridge.mjs --port /dev/cu.usbserial-0001 --device-id <id> --device-key <key> [--api http://localhost:4100/api/v1]

import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'

function parseArgs(argv) {
  const opts = { api: 'http://localhost:4100/api/v1', baud: 115200 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port') opts.port = argv[++i]
    else if (a === '--device-id') opts.deviceId = argv[++i]
    else if (a === '--device-key') opts.deviceKey = argv[++i]
    else if (a === '--api') opts.api = argv[++i]
    else if (a === '--baud') opts.baud = Number(argv[++i])
  }
  return opts
}

const opts = parseArgs(process.argv.slice(2))
if (!opts.port || !opts.deviceId || !opts.deviceKey) {
  console.error(
    'Usage: node serial-bridge.mjs --port <path> --device-id <id> --device-key <key> [--api <baseUrl>]',
  )
  process.exit(1)
}

const port = new SerialPort({ path: opts.port, baudRate: opts.baud })
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }))

port.on('error', (err) => {
  console.error('Serial port error:', err.message)
  process.exit(1)
})

console.log(`Listening on ${opts.port} @ ${opts.baud} baud, forwarding to ${opts.api}/rfid/tap`)

parser.on('data', async (line) => {
  const trimmed = line.trim()
  console.log('[board]', trimmed)

  if (!trimmed.startsWith('UID:')) return
  const rfidUID = trimmed.slice(4).trim()
  if (!rfidUID) return

  try {
    const res = await fetch(`${opts.api}/rfid/tap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': opts.deviceId,
        'X-Device-Key': opts.deviceKey,
      },
      body: JSON.stringify({ rfidUID }),
    })
    const body = await res.json().catch(() => ({}))
    console.log(`[tap] HTTP ${res.status}`, JSON.stringify(body))
  } catch (err) {
    console.error('[tap] request failed:', err.message)
  }
})
