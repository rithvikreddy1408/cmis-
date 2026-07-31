import 'dotenv/config'
import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { createRoute } from '../services/routes.service.js'
import { createBus } from '../services/buses.service.js'
import { createDriver } from '../services/drivers.service.js'
import { assignDriverToBus, assignRouteToBus } from '../services/assignment.service.js'
import type { BusRoute, Bus, Driver } from '../types/entities.js'

async function findRouteByName(routeName: string): Promise<BusRoute | null> {
  const snap = await getDb()
    .collection(COLLECTIONS.routes)
    .where('routeName', '==', routeName)
    .limit(1)
    .get()
  return snap.empty ? null : (snap.docs[0].data() as BusRoute)
}

async function ensureRoute(input: {
  routeName: string
  startPoint: string
  destination: string
  distance: number
  expectedTime: number
}): Promise<BusRoute> {
  const existing = await findRouteByName(input.routeName)
  if (existing) {
    console.log(`  route "${input.routeName}" already exists — reusing`)
    return existing
  }
  const route = await createRoute({ ...input, stops: [] })
  console.log(`  created route "${route.routeName}"`)
  return route
}

async function ensureBus(input: { busNumber: string; capacity: number }): Promise<Bus> {
  try {
    const bus = await createBus({ ...input, status: 'idle' })
    console.log(`  created bus ${bus.busNumber}`)
    return bus
  } catch (err) {
    if (err instanceof HttpError && err.code === 'DUPLICATE') {
      const snap = await getDb()
        .collection(COLLECTIONS.buses)
        .where('busNumber', '==', input.busNumber)
        .limit(1)
        .get()
      console.log(`  bus ${input.busNumber} already exists — reusing`)
      return snap.docs[0].data() as Bus
    }
    throw err
  }
}

async function ensureDriver(input: {
  name: string
  phone: string
  email: string
  licenseNumber: string
}): Promise<Driver> {
  try {
    const { driver } = await createDriver({ ...input, status: 'active' })
    console.log(`  created driver ${driver.name} (${driver.email})`)
    return driver
  } catch (err) {
    if (err instanceof HttpError && (err.code === 'DUPLICATE' || err.code === 'EMAIL_EXISTS')) {
      const snap = await getDb()
        .collection(COLLECTIONS.drivers)
        .where('licenseNumber', '==', input.licenseNumber)
        .limit(1)
        .get()
      if (!snap.empty) {
        console.log(`  driver ${input.name} already exists — reusing`)
        return snap.docs[0].data() as Driver
      }
    }
    throw err
  }
}

async function main() {
  console.log('Seeding demo routes...')
  const routeA = await ensureRoute({
    routeName: 'Route A — Main Gate to Tech Park',
    startPoint: 'Main Gate',
    destination: 'Tech Park',
    distance: 12.5,
    expectedTime: 35,
  })
  const routeB = await ensureRoute({
    routeName: 'Route B — Hostel Block to Campus',
    startPoint: 'Hostel Block',
    destination: 'Campus Circle',
    distance: 6.2,
    expectedTime: 18,
  })

  console.log('Seeding demo buses...')
  const bus1 = await ensureBus({ busNumber: 'TN-01-AB-1234', capacity: 40 })
  const bus2 = await ensureBus({ busNumber: 'TN-01-AB-5678', capacity: 45 })
  const bus3 = await ensureBus({ busNumber: 'TN-01-AB-9012', capacity: 50 })

  console.log('Seeding demo drivers...')
  const driver1 = await ensureDriver({
    name: 'Ravi Kumar',
    phone: '9876500001',
    email: 'ravi.kumar@cmis.demo',
    licenseNumber: 'DL-0001-2020',
  })
  const driver2 = await ensureDriver({
    name: 'Suresh Babu',
    phone: '9876500002',
    email: 'suresh.babu@cmis.demo',
    licenseNumber: 'DL-0002-2020',
  })
  const driver3 = await ensureDriver({
    name: 'Anitha Raj',
    phone: '9876500003',
    email: 'anitha.raj@cmis.demo',
    licenseNumber: 'DL-0003-2020',
  })

  console.log('Wiring assignments...')
  await assignDriverToBus(bus1.busId, driver1.driverId)
  await assignDriverToBus(bus2.busId, driver2.driverId)
  await assignDriverToBus(bus3.busId, driver3.driverId)
  await assignRouteToBus(bus1.busId, routeA.routeId)
  await assignRouteToBus(bus2.busId, routeA.routeId)
  await assignRouteToBus(bus3.busId, routeB.routeId)
  console.log('  bus1<->driver1<->routeA, bus2<->driver2<->routeA, bus3<->driver3<->routeB')

  console.log('\nDemo data seeded.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
