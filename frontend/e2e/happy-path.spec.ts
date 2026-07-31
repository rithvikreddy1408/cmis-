import { test, expect, type Page } from '@playwright/test'
import { cleanupTripArtifacts } from './firestore-cleanup.js'

// Full happy path: admin sets up a bus/driver/student, a driver starts a
// trip, an RFID tap is simulated the same way real reader hardware would
// call the API (see hardware/simulate-tap.mjs), a student sees themself
// tracked, the driver ends the trip, and the tap shows up in Reports.
//
// Requires the backend (localhost:4100) and frontend dev server
// (localhost:5173) already running against a real Firestore project, plus
// a seeded admin account. Set before running:
//   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
// See docs/RUNBOOK.md.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:4100/api/v1'

const RUN_ID = Date.now().toString(36)
const BUS_NUMBER = `E2E-${RUN_ID}`
const STUDENT_ROLL = `E2E${RUN_ID}`
const STUDENT_NAME = `E2E Student ${RUN_ID}`
const STUDENT_EMAIL = `e2e.student.${RUN_ID}@sreyas.ac.in`
const DRIVER_NAME = `E2E Driver ${RUN_ID}`
const DRIVER_EMAIL = `e2e.driver.${RUN_ID}@sreyas.ac.in`
const RFID_UID = `E2ECARD-${RUN_ID}`

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

test('login -> start trip -> tap -> track -> report', async ({ browser, request }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run this suite.')

  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  let driverPassword = ''
  let studentPassword = ''
  let deviceId = ''
  let deviceKey = ''
  let tripId = ''
  let busId = ''

  try {
    await test.step('admin logs in', async () => {
      await login(admin, ADMIN_EMAIL!, ADMIN_PASSWORD!)
      await expect(admin.getByText('Admin Dashboard')).toBeVisible({ timeout: 15000 })
    })

    await test.step('admin creates a bus', async () => {
      await admin.goto('/admin/buses')
      await admin.click('text=Add Bus')
      await admin.fill('input[name="busNumber"]', BUS_NUMBER)
      await admin.fill('input[name="capacity"]', '40')
      const [res] = await Promise.all([
        admin.waitForResponse((r) => r.url().includes('/buses') && r.request().method() === 'POST'),
        admin.click('button[type="submit"]'),
      ])
      expect(res.ok()).toBeTruthy()
      busId = (await res.json()).busId
    })

    await test.step('admin creates a driver and assigns them to the bus', async () => {
      await admin.goto('/admin/drivers')
      await admin.click('text=Add Driver')
      await admin.fill('input[name="name"]', DRIVER_NAME)
      await admin.fill('input[name="phone"]', '9000000001')
      await admin.fill('input[name="email"]', DRIVER_EMAIL)
      await admin.fill('input[name="licenseNumber"]', `LIC-${RUN_ID}`)
      const [res] = await Promise.all([
        admin.waitForResponse((r) => r.url().includes('/drivers') && r.request().method() === 'POST'),
        admin.click('button[type="submit"]'),
      ])
      driverPassword = (await res.json()).tempPassword

      await admin.goto('/admin/buses')
      await admin.waitForSelector(`text=${BUS_NUMBER}`, { timeout: 10000 })
      await admin
        .locator('tr', { hasText: BUS_NUMBER })
        .locator('select')
        .first()
        .selectOption({ label: DRIVER_NAME })
      await admin.waitForTimeout(500)
    })

    await test.step('admin creates a student and assigns them to the bus', async () => {
      await admin.goto('/admin/students')
      await admin.click('text=Add Student')
      await admin.fill('input[name="rollNumber"]', STUDENT_ROLL)
      await admin.fill('input[name="name"]', STUDENT_NAME)
      await admin.fill('input[name="branch"]', 'CSE')
      await admin.fill('input[name="year"]', '2')
      await admin.fill('input[name="section"]', 'A')
      await admin.fill('input[name="phone"]', '9000000002')
      await admin.fill('input[name="email"]', STUDENT_EMAIL)
      const [res] = await Promise.all([
        admin.waitForResponse((r) => r.url().includes('/students') && r.request().method() === 'POST'),
        admin.click('button[type="submit"]'),
      ])
      studentPassword = (await res.json()).tempPassword

      await admin.waitForSelector(`text=${STUDENT_ROLL}`, { timeout: 10000 })
      await admin
        .locator('tr', { hasText: STUDENT_ROLL })
        .locator('select')
        .selectOption({ label: BUS_NUMBER })
      await admin.waitForTimeout(500)
    })

    await test.step('admin issues the student a bus pass', async () => {
      // A tap is rejected with PASS_INVALID unless the student has an active pass.
      await admin.goto('/admin/passes')
      await admin.fill(
        'input[placeholder="Search student by name, roll number, or email..."]',
        STUDENT_ROLL,
      )
      await admin.click(`button:has-text("${STUDENT_ROLL}")`)
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + 180)
      await admin.fill('input[type="date"]', expiry.toISOString().slice(0, 10))
      const [res] = await Promise.all([
        admin.waitForResponse((r) => r.url().includes('/passes/issue')),
        admin.getByRole('button', { name: 'Issue', exact: true }).click(),
      ])
      expect(res.ok()).toBeTruthy()
    })

    await test.step('admin assigns an RFID card to the student', async () => {
      await admin.goto('/admin/rfid')
      await admin.click('text=Card Management')
      await admin.fill(
        'input[placeholder="Search student by name, roll number, or email..."]',
        STUDENT_ROLL,
      )
      await admin.click(`button:has-text("${STUDENT_ROLL}")`)
      await admin.fill('input[placeholder="Scan or type UID"]', RFID_UID)
      await admin.getByRole('button', { name: 'Assign', exact: true }).click()
      await admin.waitForTimeout(500)
    })

    await test.step('admin provisions an RFID reader device for the bus', async () => {
      await admin.click('text=Devices')
      await admin.getByRole('button', { name: 'Provision Device', exact: true }).click()
      await admin.locator('select').selectOption({ label: BUS_NUMBER })
      const [res] = await Promise.all([
        admin.waitForResponse((r) => r.url().endsWith('/devices') && r.request().method() === 'POST'),
        admin.getByRole('button', { name: 'Provision', exact: true }).click(),
      ])
      const body = await res.json()
      deviceId = body.device.deviceId
      deviceKey = body.rawKey
      expect(deviceId).toBeTruthy()
      expect(deviceKey).toBeTruthy()
      await admin.click('text=Done')
    })

    const driverContext = await browser.newContext()
    const driver = await driverContext.newPage()
    try {
      await test.step('driver logs in and starts a trip', async () => {
        await login(driver, DRIVER_EMAIL, driverPassword)
        await driver.waitForSelector('button:has-text("Start Trip")', { timeout: 15000 })
        const [res] = await Promise.all([
          driver.waitForResponse((r) => r.url().includes('/trips/start')),
          driver.click('button:has-text("Start Trip")'),
        ])
        tripId = (await res.json()).tripId
        expect(tripId).toBeTruthy()
        await expect(driver.getByText(/Trip active since/)).toBeVisible({ timeout: 10000 })
      })

      await test.step('a tap is simulated at the RFID reader, as real hardware would send it', async () => {
        const res = await request.post(`${API_BASE}/rfid/tap`, {
          headers: { 'X-Device-Id': deviceId, 'X-Device-Key': deviceKey },
          data: { rfidUID: RFID_UID },
        })
        expect(res.ok()).toBeTruthy()
        const body = await res.json()
        expect(body.status).toBe('ACCEPTED')
        expect(body.studentName).toBe(STUDENT_NAME)
      })

      const studentContext = await browser.newContext()
      const student = await studentContext.newPage()
      try {
        await test.step("student logs in and sees their bus, driver, and today's boarding", async () => {
          await login(student, STUDENT_EMAIL, studentPassword)
          await expect(student.getByText(/Welcome,/)).toBeVisible({ timeout: 15000 })
          await expect(student.getByText(BUS_NUMBER)).toBeVisible({ timeout: 10000 })
          await expect(student.getByText(DRIVER_NAME)).toBeVisible({ timeout: 10000 })
          await expect(student.getByText('Boarded')).toBeVisible({ timeout: 10000 })
        })
      } finally {
        await studentContext.close()
      }

      await test.step('driver ends the trip', async () => {
        const [res] = await Promise.all([
          driver.waitForResponse((r) => r.url().includes(`/trips/${tripId}/end`)),
          driver.click('button:has-text("End Trip")'),
        ])
        expect(res.ok()).toBeTruthy()
      })
    } finally {
      await driverContext.close()
    }

    await test.step('admin sees the boarding in the attendance report', async () => {
      await admin.goto('/admin/reports')
      await admin.waitForSelector('button:has-text("Run")', { timeout: 10000 })
      await admin.click('button:has-text("Run")')
      await expect(admin.getByText(STUDENT_NAME)).toBeVisible({ timeout: 10000 })
    })
  } finally {
    // Wait for the row to actually render (tables show skeletons while
    // loading, so an immediate count() check is a silent false negative),
    // then click the row action and the dialog's confirm button. Each
    // call is independently fault-tolerant — a stuck modal on one entity
    // (a slow delete, a flaky click) must never skip removing the others,
    // and must never skip the Firestore-direct sweep below either. Every
    // failure surfaces as a console warning instead of throwing, so a
    // cleanup hiccup shows up in the logs without failing the whole suite
    // over what is, structurally, teardown rather than the test itself.
    async function removeRow(path: string, rowText: string, action: string) {
      try {
        await admin.goto(path)
        const row = admin.locator(`tbody tr:has-text("${rowText}")`)
        const appeared = await row
          .first()
          .waitFor({ state: 'visible', timeout: 8000 })
          .then(() => true)
          .catch(() => false)
        if (!appeared) return
        await row.first().getByRole('button', { name: action, exact: true }).click()
        await admin.locator('.fixed.inset-0.z-50').waitFor({ state: 'visible', timeout: 5000 })
        await admin.getByRole('button', { name: action, exact: true }).last().click()
        await admin.locator('.fixed.inset-0.z-50').waitFor({ state: 'hidden', timeout: 8000 })
      } catch (err) {
        console.warn(`[cleanup] removeRow(${path}, ${rowText}) did not complete:`, err)
      }
    }

    await test.step('cleanup: remove test device, bus, driver, and student', async () => {
      if (deviceId) await removeRow('/admin/rfid', deviceId, 'Revoke')
      await removeRow('/admin/students', STUDENT_ROLL, 'Delete')
      await removeRow('/admin/drivers', DRIVER_NAME, 'Delete')
      await removeRow('/admin/buses', BUS_NUMBER, 'Delete')
    })

    await test.step('cleanup: purge the trip, attendance, and rfid card this run created', async () => {
      // No admin-facing delete endpoint for these by design (see
      // firestore-cleanup.ts) — reach into Firestore directly instead.
      // Always runs, even if a removeRow above got stuck — this is the
      // backstop, not just a nice-to-have.
      try {
        await cleanupTripArtifacts({
          rfidUID: RFID_UID,
          tripId: tripId || undefined,
          busNumber: BUS_NUMBER,
          busId: busId || undefined,
        })
      } catch (err) {
        console.warn('[cleanup] cleanupTripArtifacts did not complete:', err)
      }
    })
    await adminContext.close()
  }
})
