import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { resetEmulators, createAuthedUser, signIn } from './helpers.js'

const app = createApp()

describe('auth middleware', () => {
  beforeEach(async () => {
    await resetEmulators()
  })

  it('rejects a request with no bearer token', async () => {
    const res = await request(app).get('/api/v1/students')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('NO_TOKEN')
  })

  it('rejects a request with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', 'Bearer not-a-real-token')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('BAD_TOKEN')
  })

  it('allows an admin-role token through to an admin-only route', async () => {
    await createAuthedUser({
      email: 'admin@test.local',
      password: 'password123',
      role: 'transport_admin',
    })
    const token = await signIn('admin@test.local', 'password123')

    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('rejects a student-role token on an admin-only route', async () => {
    await createAuthedUser({
      email: 'student@test.local',
      password: 'password123',
      role: 'student',
      linkedId: 'some-student-id',
    })
    const token = await signIn('student@test.local', 'password123')

    const res = await request(app)
      .get('/api/v1/students')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })
})
