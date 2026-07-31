import 'dotenv/config'
import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { deleteDriver } from '../services/drivers.service.js'
import { deleteBus } from '../services/buses.service.js'
import { deleteRoute } from '../services/routes.service.js'

// One-time cleanup of the demo data created by seedDemoData.ts, so the admin
// can start with a clean dashboard and add real drivers/buses/routes by hand.
const DEMO_LICENSE_NUMBERS = ['DL-0001-2020', 'DL-0002-2020', 'DL-0003-2020']
const DEMO_BUS_NUMBERS = ['TN-01-AB-1234', 'TN-01-AB-5678', 'TN-01-AB-9012']
const DEMO_ROUTE_NAMES = [
  'Route A — Main Gate to Tech Park',
  'Route B — Hostel Block to Campus',
]

async function main() {
  const db = getDb()

  console.log('Removing demo drivers...')
  for (const licenseNumber of DEMO_LICENSE_NUMBERS) {
    const snap = await db
      .collection(COLLECTIONS.drivers)
      .where('licenseNumber', '==', licenseNumber)
      .limit(1)
      .get()
    if (!snap.empty) {
      const driver = snap.docs[0].data() as { name: string; driverId: string }
      await deleteDriver(driver.driverId)
      console.log(`  removed driver ${driver.name}`)
    }
  }

  console.log('Removing demo buses...')
  for (const busNumber of DEMO_BUS_NUMBERS) {
    const snap = await db
      .collection(COLLECTIONS.buses)
      .where('busNumber', '==', busNumber)
      .limit(1)
      .get()
    if (!snap.empty) {
      const bus = snap.docs[0].data() as { busNumber: string; busId: string }
      await deleteBus(bus.busId)
      console.log(`  removed bus ${bus.busNumber}`)
    }
  }

  console.log('Removing demo routes...')
  for (const routeName of DEMO_ROUTE_NAMES) {
    const snap = await db
      .collection(COLLECTIONS.routes)
      .where('routeName', '==', routeName)
      .limit(1)
      .get()
    if (!snap.empty) {
      const route = snap.docs[0].data() as { routeName: string; routeId: string }
      await deleteRoute(route.routeId)
      console.log(`  removed route ${route.routeName}`)
    }
  }

  console.log('\nDemo data removed. Dashboard is clean.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
