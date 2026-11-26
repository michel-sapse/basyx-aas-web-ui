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
    await page.addStyleTag({ content: `.v-theme--${theme} { --v-theme-primary: 120, 60, 180 !important; --v-theme-on-primary: 250, 240, 230 !important; }` })
    await expect(page.getByRole('button', { name: 'Clear range', exact: true })).toHaveCSS('background-color', 'rgb(120, 60, 180)')
    await expect(page.getByRole('button', { name: 'Clear range', exact: true })).toHaveCSS('color', 'rgb(250, 240, 230)')
    await expect(page.getByRole('button', { name: 'Apply range', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)
    await expect(page.locator('.calendar-marker').first()).toHaveCSS('background-color', 'rgb(120, 60, 180)')
    await expect(page.locator('.calendar-marker').first()).toHaveCSS('color', 'rgb(250, 240, 230)')
    const surface = await picker.evaluate(element => {
      const style = getComputedStyle(element)
      const color = (name: string) => `rgb(${style.getPropertyValue(name).split(',').map(value => value.trim()).join(', ')})`
      return { background: color('--v-theme-surface'), foreground: color('--v-theme-on-surface') }
    })
    await expect(picker).toHaveCSS('background-color', surface.background)
    await expect(page.locator('.range-date-field input').first()).toHaveCSS('color', surface.foreground)
    await page.setViewportSize({ width: 1600, height: 1000 })
    await picker.evaluate(element => {
      (element as HTMLElement).style.width = '1200px'
    })
    const calendar = page.locator('.date-range-calendar')
    const times = page.locator('.range-time-rows')
    const presets = page.locator('.range-preset')
    const expectFixedPresetHeight = async () => {
      for (const preset of await presets.all()) {
        await expect(preset).toHaveCSS('height', '44px')
        expect((await preset.boundingBox())!.height).toBe(44)
      }
    }
    await expectFixedPresetHeight()
    await expect.poll(async () => {
      const left = await calendar.boundingBox()
      const right = await times.boundingBox()
      return right!.x >= left!.x + left!.width
    }).toBe(true)
    // Narrow panel inside a wide viewport: container width, not viewport width.
    await picker.evaluate(element => {
      (element as HTMLElement).style.width = '700px'
    })
    await expect.poll(async () => {
      const top = await calendar.boundingBox()
      const bottom = await times.boundingBox()
      return bottom!.y >= top!.y + top!.height
    }).toBe(true)
    await expectFixedPresetHeight()
    await picker.evaluate(element => {
      (element as HTMLElement).style.width = '320px'
    })
    await expect.poll(async () => {
      const box = await times.boundingBox()
      const panel = await picker.boundingBox()
      return box!.x + box!.width <= panel!.x + panel!.width
    }).toBe(true)
    await expectFixedPresetHeight()
    await page.getByRole('button', { name: 'Clear range', exact: true }).click()
    await expect(page.locator('.calendar-marker')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'execute', exact: true })).toBeDisabled()
  })
}
