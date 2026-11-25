import { describe, expect, it } from 'vitest'
import { operationRecordTable, operationResultRows } from '@/utils/AAS/OperationResultUtils'

describe('operationResultRows', () => {
  it('pivots uniform records by field name and preserves lexical values', () => {
    const time = { modelType: 'Property', idShort: 'time', valueType: 'xs:dateTime', value: '2026-11-24T09:00:00Z' }
    const temperature = { modelType: 'Property', idShort: 'Temperature', valueType: 'xs:integer', value: '20' }
    const record = { modelType: 'SubmodelElementCollection', idShort: 'Record1', value: [time, temperature] }
    const records = { modelType: 'SubmodelElementCollection', value: [record, { ...record, idShort: 'Record2', value: [temperature, time] }] }
    const table = operationRecordTable(records)
    expect(table?.items).toHaveLength(2)
    expect(table?.items[1].field0).toBe(time.value)
    expect(table?.items[1].field1).toBe('20')
    expect(operationRecordTable({ ...records, value: [record, { ...record, value: [time] }] })).toBeUndefined()
    expect(operationRecordTable({ ...records, value: [record, { ...record, value: [time, time] }] })).toBeUndefined()
  })
  it('exposes nested Records values without changing the result', () => {
    const records = {
      modelType: 'SubmodelElementCollection', idShort: 'Records', value: [{
        modelType: 'SubmodelElementCollection', idShort: 'Record1', value: [
          { modelType: 'Property', idShort: 'Timestamp', valueType: 'xs:dateTime', value: '2026-11-24T10:00:00+01:00' },
          { modelType: 'Property', idShort: 'Temperature', valueType: 'xs:double', value: '20.50' },
          { modelType: 'Property', idShort: 'Unit', valueType: 'xs:string', value: '°C' },
        ],
      }],
    }
    const before = structuredClone(records)
    expect(operationResultRows(records)).toEqual([
      { path: 'Records.Record1.Timestamp', value: '2026-11-24T10:00:00+01:00', valueType: 'xs:dateTime' },
      { path: 'Records.Record1.Temperature', value: '20.50', valueType: 'xs:double' },
      { path: 'Records.Record1.Unit', value: '°C', valueType: 'xs:string' },
    ])
    expect(records).toEqual(before)
  })
  it('retains every list item, including unnamed list members', () => {
    const list = { modelType: 'SubmodelElementList', idShort: 'Samples', value: Array.from({ length: 101 }, (_, i) => ({ modelType: 'Property', valueType: 'xs:int', value: String(i) })) }
    const rows = operationResultRows(list)
    expect(rows).toHaveLength(101)
    expect(rows[100]).toEqual({ path: 'Samples[100]', value: '100', valueType: 'xs:int' })
  })
  it('distinguishes empty containers, missing values and valid false/zero values', () => {
    expect(operationResultRows({ modelType: 'SubmodelElementCollection', idShort: 'Records', value: [] })[0].value).toBe('(empty)')
    expect(operationResultRows({ modelType: 'Property' })[0].value).toBe('(no value)')
    expect(operationResultRows({ modelType: 'Property', value: false })[0].value).toBe('false')
    expect(operationResultRows({ modelType: 'Property', value: 0 })[0].value).toBe('0')
  })
  it('shows Range bounds and structured leaf values without numeric conversion', () => {
    expect(operationResultRows({ modelType: 'Range', min: '0001-01-01T00:00:00Z', max: '9999-12-31T23:59:59Z' })[0].value).toContain('0001-01-01')
    expect(operationResultRows({ modelType: 'MultiLanguageProperty', value: [{ language: 'en', text: 'hello' }] })[0].value).toContain('hello')
  })
})
