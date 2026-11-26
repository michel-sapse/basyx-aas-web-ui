import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark']) {
  test(`ReadRecords picker inherits the ${theme} UI theme`, async ({ page }) => {
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByText('SensorExampleAAS', { exact: true }).first().click()
    await page.getByText('TimeSeries', { exact: true }).first().click()
    await page.getByText('ReadRecords', { exact: true }).first().click()
    await expect(page.getByRole('region', { name: 'Select range', exact: true })).toBeVisible()
    const picker = page.locator('.read-records-range')
    // A custom primary/contrast pair must work too, not just the shipped palette.
    await picker.evaluate(element => {
      const root = element.closest('[class*="v-theme--"]') as HTMLElement
      root.style.setProperty('--v-theme-primary', '120, 60, 180')
      root.style.setProperty('--v-theme-on-primary', '250, 240, 230')
    })
    await expect(page.getByRole('button', { name: 'Apply range', exact: true })).toHaveCSS('background-color', 'rgb(120, 60, 180)')
    await expect(page.getByRole('button', { name: 'Apply range', exact: true })).toHaveCSS('color', 'rgb(250, 240, 230)')
    await expect(page.locator('.calendar-marker').first()).toHaveCSS('background-color', 'rgb(120, 60, 180)')
    await expect(page.locator('.calendar-marker').first()).toHaveCSS('color', 'rgb(250, 240, 230)')
    const surface = await picker.evaluate(element => {
      const style = getComputedStyle(element)
      return { background: `rgb(${style.getPropertyValue('--v-theme-surface').trim()})`, foreground: `rgb(${style.getPropertyValue('--v-theme-on-surface').trim()})` }
    })
    await expect(picker).toHaveCSS('background-color', surface.background)
    await expect(page.locator('.range-date-field input').first()).toHaveCSS('color', surface.foreground)
  })
}
