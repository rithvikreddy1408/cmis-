import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { getDb } from '../../src/firebase/admin.js'
import { resetEmulators, createAuthedUser, signIn } from './helpers.js'
import type { Bus, Driver } from '../../src/types/entities.js'

const app = createApp()

async function seedDriverWithBus(busId: string, driverId: string, email: string) {
  const db = getDb()
  const bus: Bus = {
    busId,
    busNumber: `B-${busId}`,
    driverId,
    routeId: null,
    capacity: 40,
    currentOccupancy: 0,
    status: 'idle',
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
  await db.collection('buses').doc(busId).set(bus)

  const uid = await createAuthedUser({
    email,
    password: 'password123',
    role: 'driver',
    linkedId: driverId,
  })
  const driver: Driver = {
    driverId,
    name: `Driver ${driverId}`,
    phone: '9999999999',
    email,
    busAssigned: busId,
    routeAssigned: null,
    licenseNumber: `LIC-${driverId}`,
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  await db.collection('drivers').doc(driverId).set(driver)

  const token = await signIn(email, 'password123')
  return { uid, token }
}

describe('trip lifecycle', () => {
  beforeEach(async () => {
    await resetEmulators()
  })

  it('starts a trip, marks the bus on_trip, and lets the driver end it', async () => {
    const { token } = await seedDriverWithBus('bus-1', 'driver-1', 'driver1@test.local')

    const startRes = await request(app)
      .post('/api/v1/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(startRes.status).toBe(201)
    expect(startRes.body.status).toBe('active')
    const tripId = startRes.body.tripId as string

    const busAfterStart = await getDb().collection('buses').doc('bus-1').get()
    expect((busAfterStart.data() as Bus).status).toBe('on_trip')

    const activeRes = await request(app)
      .get('/api/v1/trips/active')
      .set('Authorization', `Bearer ${token}`)
    expect(activeRes.status).toBe(200)
    expect(activeRes.body.tripId).toBe(tripId)

    const endRes = await request(app)
      .post(`/api/v1/trips/${tripId}/end`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(endRes.status).toBe(200)
    expect(endRes.body.status).toBe('completed')

    const busAfterEnd = await getDb().collection('buses').doc('bus-1').get()
    expect((busAfterEnd.data() as Bus).status).toBe('idle')
  })

  it('starting twice is idempotent and returns the same trip', async () => {
    const { token } = await seedDriverWithBus('bus-1', 'driver-1', 'driver1@test.local')

    const first = await request(app)
      .post('/api/v1/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    const second = await request(app)
      .post('/api/v1/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(second.body.tripId).toBe(first.body.tripId)
  })

  it('rejects ending a trip that belongs to a different driver', async () => {
    const driverA = await seedDriverWithBus('bus-1', 'driver-1', 'driver1@test.local')
    const driverB = await seedDriverWithBus('bus-2', 'driver-2', 'driver2@test.local')

    const startRes = await request(app)
      .post('/api/v1/trips/start')
      .set('Authorization', `Bearer ${driverA.token}`)
      .send({})
    const tripId = startRes.body.tripId as string

    const endRes = await request(app)
      .post(`/api/v1/trips/${tripId}/end`)
      .set('Authorization', `Bearer ${driverB.token}`)
      .send({})

    expect(endRes.status).toBe(403)
    expect(endRes.body.code).toBe('FORBIDDEN')
  })

  it('rejects a driver with no bus assigned from starting a trip', async () => {
    await createAuthedUser({
      email: 'nobus@test.local',
      password: 'password123',
      role: 'driver',
      linkedId: 'driver-nobus',
    })
    await getDb().collection('drivers').doc('driver-nobus').set({
      driverId: 'driver-nobus',
      name: 'No Bus Driver',
      phone: '0000000000',
      email: 'nobus@test.local',
      busAssigned: null,
      routeAssigned: null,
      licenseNumber: 'LIC-NOBUS',
      status: 'active',
      createdAt: new Date().toISOString(),
    })
    const token = await signIn('nobus@test.local', 'password123')

    const res = await request(app)
      .post('/api/v1/trips/start')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_BUS_ASSIGNED')
  })
})
