import { readFile } from 'node:fs/promises'

const endpoint = process.env.AAS_ENDPOINT ?? 'http://localhost:8081'
const id = Buffer.from('https://admin-shell.io/idta/TimeSeries/1/1').toString('base64url')
const elementsUrl = `${endpoint}/submodels/${id}/submodel-elements`
const operation = await readFile(new URL('operation.json', import.meta.url), 'utf8')
const existing = await fetch(`${elementsUrl}/GetTimeSeries`)
if (existing.ok) {
  const actual = await existing.json()
  const expected = JSON.parse(operation)
  if (actual.modelType !== 'Operation' || !actual.qualifiers?.some((q: { type: string, value: string }) => q.type === 'invocationDelegation' && q.value === expected.qualifiers[0].value)) {
    throw new Error('GetTimeSeries already exists with a different definition; refusing to overwrite it.')
  }
  console.log('GetTimeSeries already exists; leaving it unchanged.')
} else {
  if (existing.status !== 404) {
    throw new Error(`Operation lookup failed: ${existing.status} ${await existing.text()}`)
  }
  const response = await fetch(elementsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: operation })
  if (!response.ok) {
    throw new Error(`Operation creation failed: ${response.status} ${await response.text()}`)
  }
  console.log('GetTimeSeries added to the existing TimeSeries submodel.')
}
