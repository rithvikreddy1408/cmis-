// Firestore has no built-in "export to a file I can look at" for a
// project this size without standing up Cloud Storage + the gcloud CLI's
// managed export — this is the lightweight alternative: dump every
// collection to timestamped JSON, safe to run against the real project
// at any time since it only reads. Pair with restoreFirestore.ts.
//
// Usage: npm run backup [-- --out ./backups]
import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDb } from '../firebase/admin.js'
import { COLLECTIONS, GPS_HISTORY_SUBCOLLECTION } from '../firebase/collections.js'

function parseArgs(argv: string[]) {
  const opts = { out: './backups' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') opts.out = argv[++i] ?? opts.out
  }
  return opts
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2))
  const db = getDb()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join(out, timestamp)
  await mkdir(dir, { recursive: true })

  const collectionNames = Object.values(COLLECTIONS)
  const manifest: Record<string, number> = {}

  for (const name of collectionNames) {
    const snap = await db.collection(name).get()
    const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }))
    await writeFile(join(dir, `${name}.json`), JSON.stringify(docs, null, 2))
    manifest[name] = docs.length
    console.log(`${name}: ${docs.length} document(s)`)

    // gps/{busId}/history is the one real subcollection in this schema —
    // back it up per-parent-doc so restore can rebuild the nesting.
    if (name === COLLECTIONS.gps) {
      const historyByBus: Record<string, unknown[]> = {}
      for (const busDoc of snap.docs) {
        const historySnap = await busDoc.ref.collection(GPS_HISTORY_SUBCOLLECTION).get()
        if (!historySnap.empty) {
          historyByBus[busDoc.id] = historySnap.docs.map((d) => ({ id: d.id, data: d.data() }))
        }
      }
      if (Object.keys(historyByBus).length > 0) {
        await writeFile(join(dir, 'gps.history.json'), JSON.stringify(historyByBus, null, 2))
        const total = Object.values(historyByBus).reduce((sum, arr) => sum + arr.length, 0)
        console.log(`gps/*/history: ${total} document(s) across ${Object.keys(historyByBus).length} bus(es)`)
      }
    }
  }

  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ timestamp, counts: manifest }, null, 2))
  console.log(`\nBackup written to ${dir}`)
  console.log(
    'This is a local snapshot only — for real disaster-recovery safety, copy this ' +
      'directory (or point --out at) somewhere off this machine: a private cloud ' +
      'storage bucket, not this repo.',
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
