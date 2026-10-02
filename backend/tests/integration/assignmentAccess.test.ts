import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { resetEmulators, signIn } from './helpers.js'
import { getAuth } from '../../src/firebase/admin.js'
import { createRoute } from '../../src/services/routes.service.js'
import { createBus } from '../../src/services/buses.service.js'
import { createDriver } from '../../src/services/drivers.service.js'
import { createStudent } from '../../src/services/students.service.js'
import {
  assignDriverToBus,
  assignRouteToBus,
  assignStudentToBus,
} from '../../src/services/assignment.service.js'
import { recordPing } from '../../src/services/gps.service.js'
import { startTrip } from '../../src/services/trips.service.js'

const app = createApp()

// The product rule under test: an admin creates student and driver logins, and
// each of those accounts can reach exactly one bus — the one assigned to it.
// Everything else in the fleet must be refused, not merely hidden in the UI.
async function setupFleet() {
  const routeMine = await createRoute({
    routeName: 'Mine',
    startPoint: 'Gate',
    destination: 'Campus',
    distance: 10,
    expectedTime: 30,
    stops: [],
  })
  const routeOther = await createRoute({
    routeName: 'Other',
    startPoint: 'Hostel',
    destination: 'Campus',
    distance: 8,
    expectedTime: 25,
    stops: [],
  })

  const myBus = await createBus({ busNumber: 'BUS-MINE', capacity: 40, status: 'idle' })
  const otherBus = await createBus({ busNumber: 'BUS-OTHER', capacity: 40, status: 'idle' })
  await assignRouteToBus(myBus.busId, routeMine.routeId)
  await assignRouteToBus(otherBus.busId, routeOther.routeId)

  const { driver } = await createDriver({
    name: 'Driver One',
    phone: '9000000001',
    email: 'driver.one@test.local',
    licenseNumber: 'DL-1',
    status: 'active',
  })
  await assignDriverToBus(myBus.busId, driver.driverId)

  const { student } = await createStudent({
    rollNumber: 'S001',
    name: 'Student One',
    branch: 'CSE',
    year: 3,
    section: 'A',
    phone: '9000000002',
    email: 'student.one@test.local',
  })
  await assignStudentToBus(student.studentId, myBus.busId)

  // Admin-created accounts get a generated temp password; reset it here so the
  // test can sign in as them the same way a real user would.
  const auth = getAuth()
  const driverUser = await auth.getUserByEmail('driver.one@test.local')
  const studentUser = await auth.getUserByEmail('student.one@test.local')
  await auth.updateUser(driverUser.uid, { password: 'password123' })
  await auth.updateUser(studentUser.uid, { password: 'password123' })

  return { myBus, otherBus, routeMine, routeOther, driverUid: driverUser.uid }
}

describe('assignment-scoped access', () => {
  beforeEach(async () => {
    await resetEmulators()
  })

  it('creates student and driver logins that can actually sign in', async () => {
    await setupFleet()
    await expect(signIn('student.one@test.local', 'password123')).resolves.toBeTruthy()
    await expect(signIn('driver.one@test.local', 'password123')).resolves.toBeTruthy()
  })

  it('lets a student read their assigned bus but refuses any other bus', async () => {
    const { myBus, otherBus } = await setupFleet()
    const token = await signIn('student.one@test.local', 'password123')

    const mine = await request(app)
      .get(`/api/v1/buses/${myBus.busId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(mine.status).toBe(200)
    expect(mine.body.busNumber).toBe('BUS-MINE')

    const other = await request(app)
      .get(`/api/v1/buses/${otherBus.busId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(other.status).toBe(403)
  })

  it('lets a student read their assigned route but refuses another route', async () => {
    const { routeMine, routeOther } = await setupFleet()
    const token = await signIn('student.one@test.local', 'password123')

    const mine = await request(app)
      .get(`/api/v1/routes/${routeMine.routeId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(mine.status).toBe(200)

    const other = await request(app)
      .get(`/api/v1/routes/${routeOther.routeId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(other.status).toBe(403)
  })

  it('shows a student the live location of their bus only', async () => {
    const { myBus, otherBus, driverUid } = await setupFleet()

    // The driver grants location access and starts publishing.
    await startTrip(driverUid)
    await recordPing(driverUid, { latitude: 13.08, longitude: 80.27, speed: 8, heading: 90 })

    const token = await signIn('student.one@test.local', 'password123')

    const mine = await request(app)
      .get(`/api/v1/gps/${myBus.busId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(mine.status).toBe(200)
    expect(mine.body.latitude).toBeCloseTo(13.08)

    const other = await request(app)
      .get(`/api/v1/gps/${otherBus.busId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(other.status).toBe(403)
  })

  it('narrows bus search to the single assigned bus for a student', async () => {
    await setupFleet()
    const token = await signIn('student.one@test.local', 'password123')

    const res = await request(app)
      .get('/api/v1/buses/search')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].busNumber).toBe('BUS-MINE')
  })

  it('scopes a driver to their assigned bus too', async () => {
    const { myBus, otherBus } = await setupFleet()
    const token = await signIn('driver.one@test.local', 'password123')

    const mine = await request(app)
      .get(`/api/v1/buses/${myBus.busId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(mine.status).toBe(200)

    const other = await request(app)
      .get(`/api/v1/buses/${otherBus.busId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(other.status).toBe(403)
  })
})
