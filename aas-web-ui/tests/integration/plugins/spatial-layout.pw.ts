import { expect, test } from '@playwright/test'

const api = 'http://localhost:19081/submodels/' + Buffer.from('urn:basyx:demo:positional-data').toString('base64url')
const endpoint = api + '/submodel-elements/Positions[0].CartesianCoordinates'

test('previews a correction and persists only through explicit Save on the synthetic demo', async ({ page, request }) => {
  const source = await request.get(api)
  expect(source.ok()).toBeTruthy()
  const submodel = await source.json()
  expect(submodel.id).toBe('urn:basyx:demo:positional-data')
  const entries = submodel.submodelElements.find((element: any) => element.idShort === 'Positions').value
  expect(entries[0].value.find((element: any) => element.idShort === 'Asset').value.keys[0].value).toBe('urn:basyx:demo:aas:Server01')
  const original = entries[0].value.find((element: any) => element.idShort === 'CartesianCoordinates')
  const initialZ = original.value.find((element: any) => element.idShort === 'Zvalue').value
  const nextZ = Number(initialZ) === 20 ? '22' : '20'
  let writes = 0
  let saved = false
  page.on('request', request => {
    if (request.method() === 'PUT' && request.url().includes('CartesianCoordinates')) {
      writes++
    }
  })
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  try {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByText('RackDemo', { exact: true }).first().click()
    await page.getByText('PositionalData', { exact: true }).first().click()
    await page.getByRole('button', { name: 'Visualization', exact: true }).click()
    const z = page.getByRole('textbox', { name: 'Z coordinate', exact: true })
    await expect(z).toHaveValue(String(Number(initialZ)))
    await expect(page.getByLabel('Rack and server spatial preview. Use coordinate fields for keyboard position editing.')).toBeVisible()
    await page.getByRole('button', { name: 'Front view', exact: true }).click()
    await page.getByRole('button', { name: 'Focus selected asset', exact: true }).click()
    await z.fill(nextZ)
    await expect(page.getByText('Unsaved preview. Stored coordinates have not been changed.', { exact: true })).toBeVisible()
    expect(writes).toBe(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(z).toHaveValue(String(Number(initialZ)))
    expect(writes).toBe(0)
    await z.fill(nextZ)
    await page.screenshot({ path: test.info().outputPath('spatial-draft-light.png'), fullPage: true })
    const [response] = await Promise.all([
      page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('CartesianCoordinates')),
      page.getByRole('button', { name: 'Save coordinates', exact: true }).click(),
    ])
    expect(response.ok()).toBeTruthy()
    saved = true
    await expect(page.getByText('Showing stored coordinates.', { exact: true })).toBeVisible()
    const confirmed = await request.get(endpoint)
    expect(confirmed.ok()).toBeTruthy()
    const expected = structuredClone(original)
    expected.value.find((element: any) => element.idShort === 'Zvalue').value = nextZ
    expect(await confirmed.json()).toEqual(expected)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(z).toHaveValue(nextZ)
    await z.fill(initialZ)
    await page.getByRole('button', { name: 'Save coordinates', exact: true }).click()
    await expect(page.getByText('Showing stored coordinates.', { exact: true })).toBeVisible()
  } finally {
    // Restore exact original lexical values even if a browser assertion failed.
    if (saved) {
      const restored = await request.put(endpoint, { data: original })
      expect(restored.ok()).toBeTruthy()
    }
  }
})
