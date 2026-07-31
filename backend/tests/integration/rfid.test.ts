import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { getDb } from '../../src/firebase/admin.js'
import { provisionDevice } from '../../src/services/devices.service.js'
import { startTrip } from '../../src/services/trips.service.js'
import { resetEmulators, createAuthedUser } from './helpers.js'
import type { Bus, Driver, Student, RfidCard } from '../../src/types/entities.js'

const app = createApp()

async function seedBusDriverStudent() {
  const db = getDb()
  const busId = 'bus-1'
  const driverId = 'driver-1'
  const studentId = 'student-1'
  const rfidUID = 'CARD-0001'

  const bus: Bus = {
    busId,
    busNumber: 'B1',
    driverId,
    routeId: null,
    capacity: 40,
    currentOccupancy: 0,
    status: 'idle',
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
  await db.collection('buses').doc(busId).set(bus)

  const driverUid = await createAuthedUser({
    email: 'driver@test.local',
    password: 'password123',
    role: 'driver',
    linkedId: driverId,
  })
  const driver: Driver = {
    driverId,
    name: 'Test Driver',
    phone: '9999999999',
    email: 'driver@test.local',
    busAssigned: busId,
    routeAssigned: null,
    licenseNumber: 'LIC-1',
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  await db.collection('drivers').doc(driverId).set(driver)

  const student: Student = {
    studentId,
    rollNumber: 'R1',
    name: 'Test Student',
    branch: 'CSE',
    year: 2,
    section: 'A',
    phone: '8888888888',
    email: 'student@test.local',
    rfidUID,
    busAssigned: busId,
    routeId: null,
    passStatus: 'active',
    passExpiry: null,
    createdAt: new Date().toISOString(),
  }
  await db.collection('students').doc(studentId).set(student)

  const card: RfidCard = {
    rfidUID,
    studentId,
    status: 'active',
    assignedAt: new Date().toISOString(),
    history: [{ event: 'assigned', at: new Date().toISOString(), note: null }],
  }
  await db.collection('rfidCards').doc(rfidUID).set(card)

  const { rawKey } = await provisionDevice(busId)
  const device = (await db.collection('devices').get()).docs[0]

  return { busId, driverId, studentId, rfidUID, driverUid, deviceId: device.id, rawKey }
}

describe('RFID tap pipeline', () => {
  beforeEach(async () => {
    await resetEmulators()
  })

  it('rejects a tap from an unknown card', async () => {
    const { deviceId, rawKey, driverUid } = await seedBusDriverStudent()
    await startTrip(driverUid)

    const res = await request(app)
      .post('/api/v1/rfid/tap')
      .set('X-Device-Id', deviceId)
      .set('X-Device-Key', rawKey)
      .send({ rfidUID: 'NOT-A-REAL-CARD' })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('UNKNOWN_CARD')
  })

  it('rejects a tap when there is no active trip', async () => {
    const { deviceId, rawKey, rfidUID } = await seedBusDriverStudent()

    const res = await request(app)
      .post('/api/v1/rfid/tap')
      .set('X-Device-Id', deviceId)
      .set('X-Device-Key', rawKey)
      .send({ rfidUID })

    expect(res.status).toBe(422)
    expect(res.body.code).toBe('NO_ACTIVE_TRIP')
  })

  it('accepts a valid tap, records attendance once, and is idempotent on a repeat tap', async () => {
    const { deviceId, rawKey, rfidUID, driverUid } = await seedBusDriverStudent()
    await startTrip(driverUid)

    const first = await request(app)
      .post('/api/v1/rfid/tap')
      .set('X-Device-Id', deviceId)
      .set('X-Device-Key', rawKey)
      .send({ rfidUID })

    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({
      status: 'ACCEPTED',
      studentName: 'Test Student',
      alreadyBoarded: false,
    })

    const second = await request(app)
      .post('/api/v1/rfid/tap')
      .set('X-Device-Id', deviceId)
      .set('X-Device-Key', rawKey)
      .send({ rfidUID })

    expect(second.status).toBe(200)
    expect(second.body.alreadyBoarded).toBe(true)

    const attendanceSnap = await getDb()
      .collection('attendance')
      .where('studentId', '==', 'student-1')
      .get()
    expect(attendanceSnap.size).toBe(1)

    const busDoc = await getDb().collection('buses').doc('bus-1').get()
    expect((busDoc.data() as Bus).currentOccupancy).toBe(1)
  })

  it('rejects device auth with a wrong key', async () => {
    const { deviceId, rfidUID } = await seedBusDriverStudent()

    const res = await request(app)
      .post('/api/v1/rfid/tap')
      .set('X-Device-Id', deviceId)
      .set('X-Device-Key', 'wrong-key')
      .send({ rfidUID })

    expect(res.status).toBe(401)
    expect(res.body.code).toBe('BAD_DEVICE_KEY')
  })
})
