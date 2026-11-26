import { expect, type Page, test } from '@playwright/test'

async function selectByKeyboard (
  page: Page,
  selectIndex: number,
  downPresses: number,
) {
  const comboBox = page.locator('.v-select').nth(selectIndex).getByRole('combobox').first()
  await comboBox.click({ force: true })
  for (let i = 0; i < downPresses; i++) {
    await comboBox.press('ArrowDown')
  }
  await comboBox.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light')
  })
})

test('timeseries plugin is reachable in the example runtime', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'networkidle' })
  expect(response).not.toBeNull()
  expect(response?.ok()).toBeTruthy()

  await expect(page.getByAltText('Logo')).toBeVisible({ timeout: 30_000 })

  const aasLocator = page.getByText('SensorExampleAAS').first()
  await expect(aasLocator).toBeVisible({ timeout: 30_000 })
  await aasLocator.click()

  const submodelLocator = page.getByText('TimeSeries').first()
  await expect(submodelLocator).toBeVisible({ timeout: 30_000 })
  await submodelLocator.click()
  await page.getByRole('button', { name: 'Visualization' }).click()

  await expect(page.getByText('Preview Configuration:')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.v-select').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Preview Chart:')).toBeVisible({ timeout: 30_000 })

  await selectByKeyboard(page, 0, 1)
  await selectByKeyboard(page, 1, 1)
  await selectByKeyboard(page, 2, 2)
  await page.keyboard.press('Escape')

  const timeRangeButton = page.getByRole('button', { name: 'Time range: Last 1m' })
  const autoRefreshButton = page.getByRole('button', { name: 'Auto refresh: Off' })
  await expect(timeRangeButton).toBeVisible()
  await expect(autoRefreshButton).toBeVisible()

  const timeRangeBox = await timeRangeButton.boundingBox()
  const autoRefreshBox = await autoRefreshButton.boundingBox()
  expect(timeRangeBox).not.toBeNull()
  expect(autoRefreshBox).not.toBeNull()
  expect(Math.abs(timeRangeBox!.y - autoRefreshBox!.y)).toBeLessThan(2)

  await timeRangeButton.click()
  await expect(page.getByText('Time Range', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { exact: true, name: 'Relative' })).toBeVisible()
  const timeRangeMenu = page
    .locator('.v-overlay--active')
    .filter({ hasText: 'Time Range' })
    .locator('.v-card')
  await expect.poll(async () => (await timeRangeMenu.boundingBox())?.width ?? 0).toBeGreaterThan(390)

  const firstPresetRow = await Promise.all([
    page.getByRole('button', { name: 'Last 1 minute' }).boundingBox(),
    page.getByRole('button', { name: 'Last 5 minutes' }).boundingBox(),
    page.getByRole('button', { name: 'Last 15 minutes' }).boundingBox(),
    page.getByRole('button', { name: 'Last 1 hour' }).boundingBox(),
  ])
  expect(firstPresetRow.every(box => box !== null)).toBeTruthy()
  expect(Math.max(...firstPresetRow.map(box => box!.y)) - Math.min(...firstPresetRow.map(box => box!.y)))
    .toBeLessThan(2)
  expect(Math.max(...firstPresetRow.map(box => box!.width)) - Math.min(...firstPresetRow.map(box => box!.width)))
    .toBeLessThan(2)

  await page.getByRole('button', { name: 'Custom relative range' }).click()
  const customRangeControl = timeRangeMenu.locator('.v-text-field .v-field')
  const millisecondsButton = timeRangeMenu.getByRole('button', { name: 'Milliseconds' })
  const customRangeBox = await customRangeControl.boundingBox()
  const millisecondsBox = await millisecondsButton.boundingBox()
  expect(customRangeBox).not.toBeNull()
  expect(millisecondsBox).not.toBeNull()
  expect(Math.abs(customRangeBox!.y - millisecondsBox!.y)).toBeLessThan(2)

  await page.getByRole('button', { name: 'Last 5 minutes' }).click()
  await expect(page.getByRole('button', { name: 'Time range: Last 5m' })).toBeVisible()
  await page.getByRole('button', { name: 'Close time range menu' }).click()
  await expect(page.getByText('Time Range', { exact: true })).toBeHidden()

  await autoRefreshButton.click()
  const autoRefreshMenu = page
    .locator('.v-overlay--active')
    .filter({ hasText: 'Auto Refresh' })
    .locator('.v-card')
  const refreshIntervalInput = page.getByRole('spinbutton', { name: 'Refresh every' })
  const refreshIntervalControl = autoRefreshMenu.locator('.v-text-field .v-field')
  const secondsButton = autoRefreshMenu.getByRole('button', { name: 'Seconds' })
  const minutesButton = autoRefreshMenu.getByRole('button', { name: 'Minutes' })
  const hoursButton = autoRefreshMenu.getByRole('button', { name: 'Hours' })
  await expect(autoRefreshMenu).toBeVisible()
  await expect.poll(async () => (await autoRefreshMenu.boundingBox())?.width ?? 0).toBeGreaterThan(330)
  await expect(page.getByRole('checkbox', { name: 'Auto refresh' })).not.toBeChecked()
  await expect(refreshIntervalInput).toBeDisabled()
  await expect(minutesButton).toBeDisabled()

  const autoRefreshMenuBox = await autoRefreshMenu.boundingBox()
  const refreshIntervalBox = await refreshIntervalControl.boundingBox()
  const unitBoxes = await Promise.all([
    secondsButton.boundingBox(),
    minutesButton.boundingBox(),
    hoursButton.boundingBox(),
  ])
  expect(autoRefreshMenuBox).not.toBeNull()
  expect(refreshIntervalBox).not.toBeNull()
  expect(unitBoxes.every(box => box !== null)).toBeTruthy()
  expect(Math.max(...unitBoxes.map(box => box!.y)) - Math.min(...unitBoxes.map(box => box!.y))).toBeLessThan(2)
  expect(Math.abs(refreshIntervalBox!.y - unitBoxes[0]!.y)).toBeLessThan(2)
  expect(Math.abs(refreshIntervalBox!.height - unitBoxes[0]!.height)).toBeLessThan(2)
  expect(unitBoxes[2]!.x + unitBoxes[2]!.width).toBeLessThanOrEqual(
    autoRefreshMenuBox!.x + autoRefreshMenuBox!.width,
  )
  await page.getByRole('button', { name: 'Close auto refresh menu' }).click()

  const fetchButton = page.getByRole('button', { name: 'Fetch Data' }).locator(':visible').first()
  await expect(fetchButton).toBeVisible({ timeout: 30_000 })
  const [linkedResponse] = await Promise.all([
    page.waitForResponse(
      resp => resp.request().method() === 'POST' && (resp.url().includes('/api/v2/query') || resp.url().endsWith('/ReadRecords/invoke')),
      { timeout: 30_000 },
    ),
    fetchButton.click({ force: true }),
  ])
  expect(linkedResponse.ok()).toBeTruthy()
  const query = linkedResponse.request().postData() || ''
  if (linkedResponse.url().endsWith('/ReadRecords/invoke')) {
    const inputs = JSON.parse(query).inputArguments
    const start = inputs.find((argument: any) => argument.value.idShort === 'StartTime').value
    const end = inputs.find((argument: any) => argument.value.idShort === 'EndTime').value
    expect(start.modelType).toBe('Property')
    expect(end.modelType).toBe('Property')
    expect(Date.parse(end.value) + 1 - Date.parse(start.value)).toBe(5 * 60_000)
    expect((await linkedResponse.json()).executionState).toBe('Completed')
  } else {
    const rangeMatch = query.match(/range\(start: (\d{4}-\d{2}-\d{2}T.*?Z), stop: (\d{4}-\d{2}-\d{2}T.*?Z)\)/)
    expect(rangeMatch).not.toBeNull()
    expect(Date.parse(rangeMatch![2]) - Date.parse(rangeMatch![1])).toBe(5 * 60_000)
    expect(query).toMatch(/aggregateWindow\(every: \d+ms/)
    expect(query).not.toMatch(/v\.(timeRangeStart|timeRangeStop|windowPeriod)/)
  }

  const chartTypeSelect = page.getByRole('combobox', { name: 'Chart Type' })
  await chartTypeSelect.click({ force: true })
  await page.getByRole('option', { name: 'Line Chart' }).click()
  await expect(chartTypeSelect).toHaveValue('Line Chart')
  await expect(page.getByRole('application', { name: /line chart/i })).toBeVisible({ timeout: 30_000 })
})

for (const theme of ['light', 'dark']) {
  test('ReadRecords Figma range picker: ' + theme, async ({ page }) => {
    await page.addInitScript(value => {
      localStorage.setItem('theme', value)
      localStorage.setItem('basyx.readRecords.hourFormat', '12')
    }, theme)
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByText('SensorExampleAAS').first().click()
    await page.getByText('TimeSeries', { exact: true }).first().click()
    await page.getByText('ReadRecords', { exact: true }).first().click()
    await page.getByRole('button', { name: 'Element Details', exact: true }).click()
    const execute = page.getByRole('button', { name: 'execute', exact: true })
    const summary = page.locator('.range-summary-value')
    const picker = page.getByRole('region', { name: 'Select range', exact: true })
    await expect(picker).toBeVisible()
    await expect(execute).toBeDisabled()
    const offset = picker.getByRole('combobox', { name: 'Time zone fixed offset' })
    await offset.click()
    await page.getByRole('option', { name: 'UTC+01:00', exact: true }).click()
    await picker.getByRole('textbox', { name: 'Start date', exact: true }).fill('Nov 19, 2026')
    await picker.getByRole('textbox', { name: 'End date', exact: true }).fill('Nov 25, 2026')
    for (const bound of ['Start', 'End']) {
      for (const [part, value] of [['hour', '12'], ['minute', '00'], ['second', '43'], ['milliseconds', '815']]) {
        await picker.getByRole('combobox', { name: bound + ' ' + part, exact: true }).fill(value)
      }
    }
    await expect(picker.locator('.calendar-marker')).toHaveCount(2)
    await expect(picker.locator('.calendar-between')).toHaveCount(5)
    const marker = picker.getByRole('grid').getByRole('button', { name: /19.*November|November.*19/ })
    expect(await marker.evaluate(button => getComputedStyle(button).color)).toBe('rgb(255, 255, 255)')
    const bandColor = await picker.locator('.calendar-between').first().evaluate(cell => getComputedStyle(cell, '::before').backgroundColor)
    expect(bandColor).toMatch(/rgba/)
    const bodyBox = await picker.locator('.range-form').boundingBox()
    const sidebarBox = await picker.locator('.range-sidebar').boundingBox()
    expect(sidebarBox!.width).toBeLessThan(bodyBox!.width / 2)
    await picker.screenshot({ path: 'test-results/readrecords-range-' + theme + '.png' })
    await picker.getByRole('combobox', { name: 'End milliseconds', exact: true }).press('Enter')
    await expect(picker).toBeVisible()
    await expect(summary).toContainText('Nov 19, 2026, 12:00:43.815 → Nov 25, 2026, 12:00:43.815')
    await expect(page.locator('.range-summary-badge')).toHaveCount(0)

    await picker.getByRole('combobox', { name: 'End milliseconds', exact: true }).fill('900')
    await picker.getByRole('combobox', { name: 'End hour', exact: true }).press('Escape')
    await expect(picker.getByRole('combobox', { name: 'End milliseconds', exact: true })).toHaveValue('815')
    await expect(picker.getByRole('combobox', { name: 'Time format', exact: true })).toHaveCount(0)
    await expect(picker.getByRole('combobox', { name: 'End AM/PM', exact: true })).toHaveCount(0)
    // Use a live-data range for the real query, independent of illustrative dates.
    await picker.getByRole('button', { name: 'Last 24 hours', exact: true }).click()
    // A complete range is ready for Execute without an Apply click.
    await expect(execute).toBeEnabled()
    await page.getByRole('checkbox', { name: 'Run asynchronously' }).uncheck()
    const [response] = await Promise.all([
      page.waitForResponse(res => res.request().method() === 'POST' && res.url().endsWith('/ReadRecords/invoke')),
      execute.click(),
    ])
    expect(response.ok()).toBeTruthy()
    const inputs = JSON.parse(response.request().postData()!).inputArguments
    expect(inputs.map((argument: any) => argument.value.idShort)).toEqual(['StartTime', 'EndTime', 'Fields'])
    const start = inputs[0].value.value
    const end = inputs[1].value.value
    expect(start).toMatch(/\.\d{3}Z$/)
    expect(end).toMatch(/\.\d{3}Z$/)
    const result = await response.json()
    expect(result.executionState).toBe('Completed')
    const records = JSON.parse(result.outputArguments.find((argument: any) => argument.value.idShort === 'Records').value.value)
    expect(records.length).toBeGreaterThan(0)
    expect(records.every((record: any) => Date.parse(record.time) >= Date.parse(start) && Date.parse(record.time) <= Date.parse(end))).toBe(true)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('button', { name: 'Clear range', exact: true }).click()
    await expect(picker.getByRole('button', { name: 'Apply range', exact: true })).toHaveCount(0)
    await expect(picker.locator('.calendar-marker')).toHaveCount(0)
    await expect(execute).toBeDisabled()
    const box = await picker.getByRole('grid').boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(375)
    await picker.screenshot({ path: 'test-results/readrecords-range-mobile-' + theme + '.png' })
    await picker.getByRole('combobox', { name: 'End hour', exact: true }).press('Escape')
    await expect(execute).toBeEnabled()
  })
}
