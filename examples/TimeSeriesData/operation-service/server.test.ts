import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createOperationServer, execute, executeReadRecords } from './server.ts'

function input (min = '2026-11-24T09:00:00Z', max = '2026-11-24T09:10:00Z') {
  return [{ value: { modelType: 'Range', idShort: 'Timespan', valueType: 'xs:dateTime', min, max } }]
}

test('returns all three samples including interval boundaries and units', () => {
  const result = execute(input())
  assert.equal(result.success, true)
  assert.equal(result.outputArguments?.[0].value.value.length, 3)
  assert.equal(result.outputArguments?.[0].value.value[0].value[2].value, '°C')
})
test('supports offsets and equal bounds', () => {
  assert.equal(execute(input('2026-11-24T10:05:00+01:00', '2026-11-24T09:05:00Z')).outputArguments?.[0].value.value.length, 1)
})
test('preserves extreme years and returns empty results outside the fixture', () => {
  assert.equal(execute(input('0001-01-01T00:00:00Z', '9999-12-31T23:59:59Z')).outputArguments?.[0].value.value.length, 3)
  assert.equal(execute(input('2026-11-25T00:00:00Z', '2026-11-26T00:00:00Z')).outputArguments?.[0].value.value.length, 0)
})
test('rejects missing timezone, invalid calendar date, reversed and missing bounds', () => {
  for (const args of [input('2026-11-24T09:00:00'), input('2026-02-30T09:00:00Z'), input('2026-11-25T09:00:00Z'), []]) {
    assert.throws(() => execute(args))
  }
})
test('exposes a reproducible operation failure', () => {
  const args = [...input(), { value: { idShort: 'SimulateError', value: 'true' } }]
  assert.equal(execute(args).success, false)
})
test('ReadRecords accepts the two property inputs and returns a named Records collection', () => {
  const args = [
    { value: { idShort: 'StartTime', modelType: 'Property', valueType: 'xs:dateTime', value: '2026-11-24T10:00:00+01:00' } },
    { value: { idShort: 'EndTime', modelType: 'Property', valueType: 'xs:dateTime', value: '2026-11-24T09:05:00Z' } },
  ]
  const result = executeReadRecords(args)
  expectRecords(result, 2)
  assert.equal(result.outputArguments[0].value.value[0].value[0].idShort, 'time')
  assert.equal(result.outputArguments[0].value.value[0].value[1].valueType, 'xs:integer')
  assert.equal(result.outputArguments[0].value.value[0].value[1].value, '20')
  assert.throws(() => executeReadRecords(args.slice(0, 1)))
  args[0].value.value = '2026-11-25T00:00:00Z'
  assert.throws(() => executeReadRecords(args))
  args[1].value.value = '2026-11-26T00:00:00Z'
  expectRecords(executeReadRecords(args), 0)
})

function expectRecords (result: ReturnType<typeof executeReadRecords>, count: number) {
  assert.equal(result.outputArguments[0].value.idShort, 'Records')
  assert.equal(result.outputArguments[0].value.modelType, 'SubmodelElementCollection')
  assert.equal(result.outputArguments[0].value.value.length, count)
}
test('HTTP service handles health, successful calls, malformed JSON and unknown routes', async () => {
  const server = createOperationServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}`
  try {
    assert.equal((await fetch(`${url}/health`)).status, 200)
    const result = await fetch(`${url}/timeseries`, { method: 'POST', body: JSON.stringify(input()) })
    assert.equal(result.status, 200)
    assert.equal((await result.json()).outputArguments[0].value.value.length, 3)
    assert.equal((await fetch(`${url}/timeseries`, { method: 'POST', body: '{' })).status, 400)
    assert.equal((await fetch(`${url}/missing`)).status, 404)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
