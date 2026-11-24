import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

const endpoint = process.env.AAS_ENDPOINT ?? 'http://localhost:8081'
const id = Buffer.from('https://admin-shell.io/idta/TimeSeries/1/1').toString('base64url')
const url = `${endpoint}/submodels/${id}/submodel-elements/GetTimeSeries`
const operation = JSON.parse(await readFile(new URL('operation.json', import.meta.url), 'utf8'))

async function invoke (min: string, max: string, simulateError = false, async = false) {
  const inputArguments = structuredClone(operation.inputVariables)
  inputArguments[0].value.min = min
  inputArguments[0].value.max = max
  inputArguments[1].value.value = String(simulateError)
  return fetch(`${url}/${async ? 'invoke-async' : 'invoke'}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'manual',
    body: JSON.stringify({ inputArguments, inoutputArguments: [], clientTimeoutDuration: 'PT10S' }),
  })
}

const response = await invoke('2026-11-24T09:00:00Z', '2026-11-24T09:10:00Z')
assert.equal(response.status, 200, await response.clone().text())
assert.equal((await response.json()).outputArguments[0].value.value.length, 3)
const empty = await invoke('2026-11-25T00:00:00Z', '2026-11-26T00:00:00Z')
assert.equal(empty.status, 200)
assert.equal((await empty.json()).outputArguments[0].value.value.length, 0)
const failure = await invoke('2026-11-24T09:00:00Z', '2026-11-24T09:10:00Z', true)
assert.equal((await failure.json()).success, false)
const invalid = await invoke('2026-11-25T09:00:00Z', '2026-11-24T09:00:00Z')
assert.ok(!invalid.ok || (await invalid.json()).success === false)

const asyncResponse = await invoke('2026-11-24T09:00:00Z', '2026-11-24T09:10:00Z', false, true)
assert.equal(asyncResponse.status, 202, await asyncResponse.clone().text())
const location = asyncResponse.headers.get('Location')
assert.ok(location)
const statusUrl = new URL(location, url)
assert.equal(statusUrl.origin, new URL(endpoint).origin)
let completed = false
for (let attempt = 0; attempt < 100; attempt++) {
  const status = await fetch(statusUrl, { redirect: 'manual' })
  if (status.status === 302) {
    const resultLocation = status.headers.get('Location')
    assert.ok(resultLocation)
    const resultUrl = new URL(resultLocation, statusUrl)
    assert.equal(resultUrl.origin, statusUrl.origin)
    const result = await fetch(resultUrl)
    assert.equal(result.status, 200)
    assert.equal((await result.json()).outputArguments[0].value.value.length, 3)
    completed = true
    break
  }
  assert.equal(status.status, 200)
  await setTimeout(100)
}
assert.ok(completed, 'Async operation did not complete within 10 seconds')
console.log('PASS: real AAS backend → delegated service → sync/async results, empty, error and invalid interval')

const recordsOperation = JSON.parse(await readFile(new URL('readrecords.json', import.meta.url), 'utf8'))
const recordsUrl = `${endpoint}/submodels/${id}/submodel-elements/ReadRecords`
const recordsResponse = await fetch(`${recordsUrl}/invoke`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ inputArguments: recordsOperation.inputVariables, inoutputArguments: [], clientTimeoutDuration: 'PT10S' }),
})
assert.equal(recordsResponse.status, 200, await recordsResponse.clone().text())
const recordsResult = await recordsResponse.json()
assert.equal(recordsResult.outputArguments[0].value.idShort, 'Records')
assert.equal(recordsResult.outputArguments[0].value.modelType, 'SubmodelElementCollection')
assert.equal(recordsResult.outputArguments[0].value.value.length, 3)
// Invocation results must not mutate the saved operation definition.
const persisted = await (await fetch(recordsUrl)).json()
assert.deepEqual(persisted.outputVariables[0].value.value, [])
console.log('PASS: ReadRecords property inputs → Records collection, without persistence')
