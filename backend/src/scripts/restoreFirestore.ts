// Restores from a directory produced by backupFirestore.ts. Defaults to a
// dry run — prints exactly what it would write and how many documents,
// per collection, without touching Firestore — so a fat-fingered restore
// command doesn't compound the original mistake. Pass --confirm to
// actually write, and optionally --collection <name> to restore just one
// (the common case: an admin accidentally bulk-deleted students, not the
// whole database).
//
// Usage:
//   npm run restore -- --dir ./backups/2026-07-26T... [--collection students] [--confirm]
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from '../firebase/admin.js'
import { COLLECTIONS, GPS_HISTORY_SUBCOLLECTION } from '../firebase/collections.js'

function parseArgs(argv: string[]) {
  const opts: { dir?: string; collection?: string; confirm: boolean } = { confirm: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') opts.dir = argv[++i]
    else if (argv[i] === '--collection') opts.collection = argv[++i]
    else if (argv[i] === '--confirm') opts.confirm = true
  }
  return opts
}

interface BackedUpDoc {
  id: string
  data: FirebaseFirestore.DocumentData
}

async function restoreCollection(dir: string, name: string, confirm: boolean) {
  const filePath = join(dir, `${name}.json`)
  let docs: BackedUpDoc[]
  try {
    docs = JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    console.log(`${name}: no backup file found, skipping`)
    return
  }

  console.log(`${name}: ${docs.length} document(s) ${confirm ? 'being restored' : 'would be restored (dry run)'}`)
  if (!confirm || docs.length === 0) return

  const db = getDb()
  const BATCH_SIZE = 400 // Firestore batch write cap is 500; leave headroom
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of docs.slice(i, i + BATCH_SIZE)) {
      batch.set(db.collection(name).doc(doc.id), doc.data)
    }
    await batch.commit()
  }
}

async function restoreGpsHistory(dir: string, confirm: boolean) {
  const filePath = join(dir, 'gps.history.json')
  let historyByBus: Record<string, BackedUpDoc[]>
  try {
    historyByBus = JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return
  }
  const total = Object.values(historyByBus).reduce((sum, arr) => sum + arr.length, 0)
  console.log(`gps/*/history: ${total} document(s) ${confirm ? 'being restored' : 'would be restored (dry run)'}`)
  if (!confirm) return

  const db = getDb()
  for (const [busId, docs] of Object.entries(historyByBus)) {
    const col = db.collection(COLLECTIONS.gps).doc(busId).collection(GPS_HISTORY_SUBCOLLECTION)
    for (const doc of docs) {
      await col.doc(doc.id).set(doc.data)
    }
  }
}

async function main() {
  const { dir, collection, confirm } = parseArgs(process.argv.slice(2))
  if (!dir) {
    console.error('Usage: npm run restore -- --dir <backup-directory> [--collection <name>] [--confirm]')
    process.exit(1)
  }

  const manifestRaw = await readFile(join(dir, 'manifest.json'), 'utf-8').catch(() => null)
  if (manifestRaw) {
    const manifest = JSON.parse(manifestRaw)
    console.log(`Backup from ${manifest.timestamp}`)
  }
  if (!confirm) {
    console.log('DRY RUN — pass --confirm to actually write. Nothing has been touched yet.\n')
  }

  const targets = collection ? [collection] : Object.values(COLLECTIONS)
  for (const name of targets) {
    await restoreCollection(dir, name, confirm)
    if (name === COLLECTIONS.gps) await restoreGpsHistory(dir, confirm)
  }

  if (confirm) console.log('\nRestore complete.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
