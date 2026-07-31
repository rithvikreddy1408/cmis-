import { test, expect } from '@playwright/test'

// Visual regression on the two fully static, auth-free pages only —
// anything with live data (dashboards, lists) would flag a "regression"
// every time a real student/bus gets added, which is noise, not a real
// UI bug. This exists to catch exactly the class of bug found by hand
// this session: a font silently failing to load, a background going
// white by accident, a button losing its style.
test.describe('visual regression', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('input[type="email"]')
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('login.png', { maxDiffPixelRatio: 0.02 })
  })

  test('forgot password page', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForSelector('input[type="email"]')
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('forgot-password.png', { maxDiffPixelRatio: 0.02 })
  })
})
