import { describe, expect, it } from 'vitest'
import { operationRecordTable, operationResultRows } from '@/utils/AAS/OperationResultUtils'

describe('operationResultRows', () => {
  it('takes column order and types from metadata, never using metadata example values as measurements', () => {
    const time = { modelType: 'Property', idShort: 'Time', valueType: 'xs:dateTime', value: '2026-11-10T23:00:07.023Z' }
    const load = { modelType: 'Property', idShort: 'node_load1', valueType: 'xs:double', value: '0.17' }
    const schema = [
      { modelType: 'Property', idShort: 'network', valueType: 'xs:double', value: '999' },
      { ...time, value: undefined },
      { ...load, value: undefined },
    ]
    const table = operationRecordTable({ modelType: 'SubmodelElementCollection', value: [
      { modelType: 'SubmodelElementCollection', idShort: 'Record001', value: [time, load] },
    ] }, schema)
    expect(table?.fields.map(field => field.idShort)).toEqual(['network', 'Time', 'node_load1'])
    expect(table?.items[0]).toEqual({ record: 'Record001', field0: '(no value)', field1: time.value, field2: '0.17' })
    expect(table?.undeclaredFields).toEqual([])
    const empty = operationRecordTable({ modelType: 'SubmodelElementCollection', value: [] }, schema)
    expect(empty?.fields).toEqual(schema)
    expect(empty?.items).toEqual([])
  })
  it('appends and identifies undeclared returned fields without discarding them', () => {
    const declared = { modelType: 'Property', idShort: 'Time', valueType: 'xs:dateTime' }
    const extra = { modelType: 'Property', idShort: 'ExtraMetric', valueType: 'xs:double', value: '1.5' }
    const table = operationRecordTable({ modelType: 'SubmodelElementCollection', value: [
      { modelType: 'SubmodelElementCollection', value: [extra] },
    ] }, [declared])
    expect(table?.fields).toEqual([declared, extra])
    expect(table?.undeclaredFields).toEqual(['ExtraMetric'])
    expect(table?.items[0].field1).toBe('1.5')
  })
  it('pivots uniform records by field name and preserves lexical values', () => {
    const time = { modelType: 'Property', idShort: 'time', valueType: 'xs:dateTime', value: '2026-11-24T09:00:00Z' }
    const temperature = { modelType: 'Property', idShort: 'Temperature', valueType: 'xs:integer', value: '20' }
    const record = { modelType: 'SubmodelElementCollection', idShort: 'Record1', value: [time, temperature] }
    const records = { modelType: 'SubmodelElementCollection', value: [record, { ...record, idShort: 'Record2', value: [temperature, time] }] }
    const table = operationRecordTable(records)
    expect(table?.items).toHaveLength(2)
    expect(table?.items[1].field0).toBe(time.value)
    expect(table?.items[1].field1).toBe('20')
    expect(operationRecordTable({ ...records, value: [record, { ...record, value: [time] }] })?.items[1].field1).toBe('(no value)')
    expect(operationRecordTable({ ...records, value: [record, { ...record, value: [time, time] }] })).toBeUndefined()
  })
  it('pivots sparse production-style metrics into the union of columns without filling gaps', () => {
    const time = { modelType: 'Property', idShort: 'Time', valueType: 'xs:dateTime', value: '2026-11-10T23:00:07.023Z' }
    const load = { modelType: 'Property', idShort: 'node_load1', valueType: 'xs:double', value: '0.17' }
    const network = { modelType: 'Property', idShort: 'node_network_transmit_bytes_rate5m', valueType: 'xs:double', value: '141783.53703703705' }
    const records = { modelType: 'SubmodelElementCollection', idShort: 'Records', value: [
      { modelType: 'SubmodelElementCollection', idShort: 'Record001', value: [time, load] },
      { modelType: 'SubmodelElementCollection', idShort: 'Record002', value: [{ ...time, value: '2026-11-10T23:00:14.963Z' }, network] },
    ] }
    const before = structuredClone(records)
    const table = operationRecordTable(records)
    expect(table?.fields.map(field => field.idShort)).toEqual(['Time', 'node_load1', 'node_network_transmit_bytes_rate5m'])
    expect(table?.items).toEqual([
      { record: 'Record001', field0: time.value, field1: '0.17', field2: '(no value)' },
      { record: 'Record002', field0: '2026-11-10T23:00:14.963Z', field1: '(no value)', field2: network.value },
    ])
    expect(records).toEqual(before)
  })
  it('retains all 8094 sparse records and their numeric lexical values', () => {
    const records = { modelType: 'SubmodelElementCollection', idShort: 'Records', value: Array.from({ length: 8094 }, (_, index) => ({
      modelType: 'SubmodelElementCollection', idShort: `Record${index + 1}`, value: [
        { modelType: 'Property', idShort: 'Time', valueType: 'xs:dateTime', value: '2026-11-10T23:00:07.023Z' },
        { modelType: 'Property', idShort: index % 2 === 0 ? 'node_load1' : 'network', valueType: 'xs:double', value: String(index) },
      ],
    })) }
    const table = operationRecordTable(records)
    expect(table?.items).toHaveLength(8094)
    expect(table?.items[8093].field2).toBe('8093')
    expect(table?.items[8093].field1).toBe('(no value)')
  })
  it('keeps incompatible types and nested structures in the generic lossless view', () => {
    const field = { modelType: 'Property', idShort: 'Metric', valueType: 'xs:double', value: '1.5' }
    const record = { modelType: 'SubmodelElementCollection', value: [field] }
    expect(operationRecordTable({ modelType: 'SubmodelElementCollection', value: [record, { ...record, value: [{ ...field, valueType: 'xs:string' }] }] })).toBeUndefined()
    expect(operationRecordTable({ modelType: 'SubmodelElementCollection', value: [record, { ...record, value: [record] }] })).toBeUndefined()
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
