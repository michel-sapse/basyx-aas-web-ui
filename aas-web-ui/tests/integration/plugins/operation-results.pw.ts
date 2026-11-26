import { expect, test } from '@playwright/test'

test('ReadRecords results survive tree navigation and paginate without persistence', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByText('SensorExampleAAS', { exact: true }).first().click()
  await page.getByText('TimeSeries', { exact: true }).first().click()
  await expect(page).toHaveURL(/path=/)
  await page.getByText('ReadRecords', { exact: true }).first().click()
  await expect(page).toHaveURL(/ReadRecords/)
  await page.getByRole('button', { name: 'execute', exact: true }).click()

  await expect(page.getByLabel('Records (25)', { exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Temperature [°C]', exact: true })).toBeVisible()
  const rows = page.locator('.records-table tbody tr')
  await expect(rows).toHaveCount(10)
  await page.getByRole('columnheader', { name: 'Temperature [°C]', exact: true }).click()
  await expect(rows.first()).toContainText('Record1')
  await page.getByRole('columnheader', { name: 'Temperature [°C]', exact: true }).press('Enter')
  await expect(rows.first()).toContainText('Record25')
  await page.getByRole('columnheader', { name: 'time', exact: true }).click()
  await expect(rows.first()).toContainText('Record1')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByText('11–20 of 25 records', { exact: true })).toBeVisible()
  await expect(rows).toHaveCount(10)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByText('21–25 of 25 records', { exact: true })).toBeVisible()
  await expect(rows).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()

  await page.getByRole('textbox', { name: 'Search records', exact: true }).fill('Record25')
  await expect(rows).toHaveCount(1)
  await expect(page.getByText('1–1 of 1 records', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search records', exact: true }).fill('')
  await expect(rows).toHaveCount(10)
  await page.getByRole('textbox', { name: 'Search records', exact: true }).fill('not-a-record')
  await expect(page.getByText('No records match the search and filters.', { exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Search records', exact: true }).fill('')

  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.getByRole('button', { name: 'Add condition', exact: true }).click()
  await page.getByRole('combobox', { name: 'Column 1', exact: true }).press('ArrowDown')
  await page.getByRole('option', { name: 'Temperature', exact: true }).click()
  await page.getByRole('combobox', { name: 'Operator 1', exact: true }).press('ArrowDown')
  await page.getByRole('option', { name: 'is greater than or equal to', exact: true }).click()
  await page.getByRole('textbox', { name: 'Value 1', exact: true }).fill('40')
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(rows).toHaveCount(5)
  await expect(page.getByText('5 of 25 records match.', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Columns', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Humidity', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: /Humidity/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
  await page.getByRole('radio', { name: 'Filtered records (5)', exact: true }).check()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export 5 records', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('records.csv')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('Record25')
  expect(csv).not.toContain('Humidity')
  expect(csv.split('\r\n')).toHaveLength(7)

  await page.getByText('[0] Records', { exact: true }).click()
  await expect(page.getByText(/Temporary, read-only result/)).toBeVisible()
  await expect(page.getByLabel('Records (25)', { exact: true })).toBeVisible()
  await page.getByText('ReadRecords', { exact: true }).first().click()
  await expect(page.getByLabel('Records (25)', { exact: true })).toBeVisible()

  await page.getByText('[0] Records', { exact: true }).click()
  await expect(page.getByText(/Temporary, read-only result/)).toBeVisible()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByText(/Temporary, read-only result/)).toHaveCount(0)
  await expect(page.getByLabel('Records (25)', { exact: true })).toHaveCount(0)
})

test('sparse metric records keep the column table and export empty cells for missing metrics', async ({ page }) => {
  const schema = [
    { modelType: 'Property', idShort: 'Time', valueType: 'xs:dateTime' },
    { modelType: 'Property', idShort: 'node_load1', valueType: 'xs:double' },
    { modelType: 'Property', idShort: 'node_memory_MemAvailable_bytes', valueType: 'xs:double', value: '999' },
    { modelType: 'Property', idShort: 'node_memory_MemTotal_bytes', valueType: 'xs:double' },
    { modelType: 'Property', idShort: 'node_network_transmit_bytes_rate5m', valueType: 'xs:double' },
  ]
  await page.route('**/submodel-elements/Metadata', route => route.fulfill({
    json: { modelType: 'SubmodelElementCollection', idShort: 'Metadata', value: [{ modelType: 'SubmodelElementCollection', idShort: 'Record', value: schema }] },
  }))
  const records = Array.from({ length: 25 }, (_, index) => ({
    modelType: 'SubmodelElementCollection', idShort: `Record${String(index + 1).padStart(3, '0')}`,
    value: [
      { modelType: 'Property', idShort: 'Time', valueType: 'xs:dateTime', value: new Date(Date.parse('2026-11-24T09:00:00Z') + index * 300_000).toISOString() },
      { modelType: 'Property', idShort: index % 2 === 0 ? 'node_load1' : 'node_network_transmit_bytes_rate5m', valueType: 'xs:double', value: index % 2 === 0 ? '0.17' : '141783.53703703705' },
    ],
  }))
  await page.route('**/submodel-elements/ReadRecords/invoke-async', route => route.fulfill({ status: 405 }))
  await page.route('**/submodel-elements/ReadRecords/invoke', route => route.fulfill({
    json: { executionState: 'Completed', success: true, outputArguments: [{ value: { modelType: 'SubmodelElementCollection', idShort: 'Records', value: records } }] },
  }))
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByText('SensorExampleAAS', { exact: true }).first().click()
  await page.getByText('TimeSeries', { exact: true }).first().click()
  await expect(page).toHaveURL(/path=/)
  await page.getByText('ReadRecords', { exact: true }).first().click()
  await expect(page).toHaveURL(/ReadRecords/)
  await page.getByRole('button', { name: 'execute', exact: true }).click()
  await expect(page.getByLabel('Records (25)', { exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'node_load1', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'node_network_transmit_bytes_rate5m', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'node_memory_MemAvailable_bytes', exact: true })).toBeVisible()
  const rows = page.locator('.records-table tbody tr')
  await expect(rows).toHaveCount(10)
  await expect(rows.nth(0).getByLabel('No value')).toHaveCount(3)
  await expect(rows.nth(1).getByLabel('No value')).toHaveCount(3)
  await page.getByRole('textbox', { name: 'Search records', exact: true }).fill('Record002')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('141783.53703703705')
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
  await page.getByRole('radio', { name: 'Filtered records (1)', exact: true }).check()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export 1 records', exact: true }).click()
  const stream = await (await downloadPromise).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  const csv = Buffer.concat(chunks).toString('utf8')
  expect(csv).toContain('"Record002","2026-11-24T09:05:00.000Z","","","","141783.53703703705"')
  expect(csv).not.toContain('(no value)')
})
