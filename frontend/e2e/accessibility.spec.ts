import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import type { Result } from 'axe-core'

// axe-core catches a meaningfully different (and broader) rule set than
// Lighthouse's accessibility category — this exists because "Lighthouse
// says 100" isn't the same claim as "a real automated accessibility
// engine found nothing," and the two have already disagreed once this
// project (Lighthouse missed things axe's own rule set catches on other
// projects, and vice versa). Scans every real route across all three
// portals, not a sample.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const RUN_ID = Date.now().toString(36)

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

async function scan(page: Page, path: string) {
  if (path !== page.url()) {
    await page.goto(path)
    await page.waitForTimeout(1500)
  }
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
}

function describeViolations(violations: Result[]) {
  return violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
    .join('\n')
}

test.describe('accessibility (axe-core)', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run this suite.')

  test('public pages', async ({ page }) => {
    for (const path of ['/login', '/forgot-password']) {
      const violations = await scan(page, path)
      expect(violations, describeViolations(violations)).toEqual([])
    }
  })

  test('admin portal', async ({ page }) => {
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!)
    await page.waitForSelector('text=Admin Dashboard', { timeout: 15000 })

    const paths = [
      '/admin',
      '/admin/students',
      '/admin/drivers',
      '/admin/buses',
      '/admin/routes',
      '/admin/routes/new',
      '/admin/rfid',
      '/admin/passes',
      '/admin/notifications',
      '/admin/reports',
      '/admin/settings',
    ]
    for (const path of paths) {
      const violations = await scan(page, path)
      expect(violations, `${path}\n${describeViolations(violations)}`).toEqual([])
    }
  })

  test('driver and student portals', async ({ page }) => {
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!)
    await page.waitForSelector('text=Admin Dashboard', { timeout: 15000 })

    const driverEmail = `a11y-audit.driver.${RUN_ID}@sreyas.ac.in`
    const studentEmail = `a11y-audit.student.${RUN_ID}@sreyas.ac.in`

    await page.goto('/admin/drivers')
    await page.click('text=Add Driver')
    await page.fill('input[name="name"]', `A11y Audit Driver ${RUN_ID}`)
    await page.fill('input[name="phone"]', '9000000001')
    await page.fill('input[name="email"]', driverEmail)
    await page.fill('input[name="licenseNumber"]', `LIC-A11Y-${RUN_ID}`)
    const [driverRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/drivers') && r.request().method() === 'POST'),
      page.click('button[type="submit"]'),
    ])
    const driverPassword = (await driverRes.json()).tempPassword

    await page.goto('/admin/students')
    await page.click('text=Add Student')
    await page.fill('input[name="rollNumber"]', `A11YAUDIT${RUN_ID}`)
    await page.fill('input[name="name"]', `A11y Audit Student ${RUN_ID}`)
    await page.fill('input[name="branch"]', 'CSE')
    await page.fill('input[name="year"]', '2')
    await page.fill('input[name="section"]', 'A')
    await page.fill('input[name="phone"]', '9000000002')
    await page.fill('input[name="email"]', studentEmail)
    const [studentRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/students') && r.request().method() === 'POST'),
      page.click('button[type="submit"]'),
    ])
    const studentPassword = (await studentRes.json()).tempPassword

    try {
      const driverContext = await page.context().browser()!.newContext()
      const driverPage = await driverContext.newPage()
      try {
        await login(driverPage, driverEmail, driverPassword)
        // This driver has no bus assigned, so the dashboard always shows
        // this state — no ambiguity to wait for.
        await driverPage.waitForSelector('text=No bus assigned', { timeout: 15000 })
        for (const path of ['/driver', '/driver/history', '/driver/notifications']) {
          const violations = await scan(driverPage, path)
          expect(violations, `${path}\n${describeViolations(violations)}`).toEqual([])
        }
      } finally {
        await driverContext.close()
      }

      const studentContext = await page.context().browser()!.newContext()
      const studentPage = await studentContext.newPage()
      try {
        await login(studentPage, studentEmail, studentPassword)
        await studentPage.waitForSelector('text=Welcome,', { timeout: 15000 })
        for (const path of ['/student', '/student/search', '/student/attendance', '/student/pass', '/student/notifications']) {
          const violations = await scan(studentPage, path)
          expect(violations, `${path}\n${describeViolations(violations)}`).toEqual([])
        }
      } finally {
        await studentContext.close()
      }
    } finally {
      // Cleanup via the same admin UI session used to create the fixtures.
      await page.goto('/admin/drivers')
      await page.waitForSelector(`text=A11y Audit Driver ${RUN_ID}`, { timeout: 10000 }).catch(() => {})
      const driverRow = page.locator(`tr:has-text("A11y Audit Driver ${RUN_ID}")`)
      if (await driverRow.count()) {
        await driverRow.getByRole('button', { name: 'Delete' }).click()
        await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
        await page.waitForTimeout(500)
      }

      await page.goto('/admin/students')
      await page.waitForSelector(`text=A11YAUDIT${RUN_ID}`, { timeout: 10000 }).catch(() => {})
      const studentRow = page.locator(`tr:has-text("A11YAUDIT${RUN_ID}")`)
      if (await studentRow.count()) {
        await studentRow.getByRole('button', { name: 'Delete' }).click()
        await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
        await page.waitForTimeout(500)
      }
    }
  })
})
