import { beforeEach, describe, expect, it } from 'vitest'
import { resetEmulators, signIn } from './helpers.js'
import { createDriver } from '../../src/services/drivers.service.js'
import { createStudent } from '../../src/services/students.service.js'

// The admin can hand over a password directly instead of relying on a
// generated one that is shown once and easily lost.
describe('admin-chosen account passwords', () => {
  beforeEach(async () => {
    await resetEmulators()
  })

  it('uses the password the admin set for a driver', async () => {
    const { tempPassword } = await createDriver({
      name: 'D', phone: '9000000001', email: 'd@test.local',
      licenseNumber: 'DL-9', status: 'active', password: 'chosen-pass-1',
    })
    expect(tempPassword).toBe('chosen-pass-1')
    await expect(signIn('d@test.local', 'chosen-pass-1')).resolves.toBeTruthy()
  })

  it('uses the password the admin set for a student', async () => {
    const { tempPassword } = await createStudent({
      rollNumber: 'R1', name: 'S', branch: 'CSE', year: 2, section: 'A',
      phone: '9000000002', email: 's@test.local', password: 'chosen-pass-2',
    })
    expect(tempPassword).toBe('chosen-pass-2')
    await expect(signIn('s@test.local', 'chosen-pass-2')).resolves.toBeTruthy()
  })

  it('still generates a usable password when none is given', async () => {
    const { tempPassword } = await createStudent({
      rollNumber: 'R2', name: 'S2', branch: 'CSE', year: 2, section: 'B',
      phone: '9000000003', email: 's2@test.local',
    })
    expect(tempPassword).toBeTruthy()
    expect(tempPassword).not.toBe('chosen-pass-2')
    await expect(signIn('s2@test.local', tempPassword)).resolves.toBeTruthy()
  })

  it('never writes the password into the stored record', async () => {
    const { student } = await createStudent({
      rollNumber: 'R3', name: 'S3', branch: 'CSE', year: 3, section: 'C',
      phone: '9000000004', email: 's3@test.local', password: 'secret-pass-3',
    })
    expect(JSON.stringify(student)).not.toContain('secret-pass-3')
  })
})
