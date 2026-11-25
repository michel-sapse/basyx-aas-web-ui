import type { RecordColumn, RecordFilter } from '@/utils/AAS/RecordTableUtils'
import { describe, expect, it } from 'vitest'
import { filterRecordRows, recordFilterError, recordsCsv, sortRecordRows } from '@/utils/AAS/RecordTableUtils'

const columns: RecordColumn[] = [
  { key: 'record', title: 'Record' },
  { key: 'time', title: 'Time', valueType: 'xs:dateTime' },
  { key: 'temperature', title: 'Temperature', valueType: 'xs:integer', unit: '°C' },
]
const rows = Array.from({ length: 25 }, (_, i) => ({ record: `Record${i + 1}`, time: '2026-11-24T09:00:00Z', temperature: String(i + 20) }))

describe('record table queries', () => {
  it('combines case-insensitive search with multiple AND conditions across all pages', () => {
    const filters: RecordFilter[] = [
      { key: 'temperature', operator: 'gte', value: '25' },
      { key: 'temperature', operator: 'lt', value: '40' },
    ]
    expect(filterRecordRows(rows, columns, '', filters)).toHaveLength(15)
    expect(filterRecordRows(rows, columns, 'record2', filters).map(row => row.record)).toEqual(['Record20'])
    expect(filterRecordRows(rows, columns, 'missing', [])).toEqual([])
  })
  it('sorts numerically without corrupting large integer values or original rows', () => {
    const input = ['10', '2', '9007199254740993', '9007199254740992'].map(temperature => ({ temperature }))
    expect(sortRecordRows(input, columns, [{ key: 'temperature', order: 'asc' }]).map(row => row.temperature))
      .toEqual(['2', '10', '9007199254740992', '9007199254740993'])
    expect(input[0].temperature).toBe('10')
    expect(filterRecordRows(input, columns, '', [{ key: 'temperature', operator: 'eq', value: '9007199254740993' }])).toHaveLength(1)
  })
  it('compares time instants with offsets and rejects invalid numeric/time filters', () => {
    expect(filterRecordRows(rows, columns, '', [{ key: 'time', operator: 'eq', value: '2026-11-24T10:00:00+01:00' }])).toHaveLength(25)
    expect(recordFilterError({ key: 'temperature', operator: 'gte', value: 'abc' }, columns)).not.toBe('')
    expect(recordFilterError({ key: 'time', operator: 'eq', value: '2026-11-24T09:00:00' }, columns)).toContain('timezone')
    expect(filterRecordRows([{ temperature: '(no value)' }], columns, '', [{ key: 'temperature', operator: 'gte', value: '0' }])).toEqual([])
  })
})

describe('CSV export', () => {
  it('exports exactly the supplied row and column selection, with units and lexical values', () => {
    const csv = recordsCsv(rows.slice(20), [columns[0], columns[2]], true)
    expect(csv.startsWith('\uFEFF"Record","Temperature [°C]"\r\n')).toBe(true)
    expect(csv).toContain('"Record25","44"')
    expect(csv).not.toContain('Record1')
    expect(csv.split('\r\n')).toHaveLength(7)
    expect(recordsCsv([rows[0]], [columns[2]], false)).toBe('\uFEFF"20"\r\n')
  })
  it('quotes commas, quotes, newlines and protects formula-like text without altering negative numbers', () => {
    expect(recordsCsv([{ record: 'a,"b"\nc', temperature: '-20' }], [columns[0], columns[2]], false))
      .toBe('\uFEFF"a,""b""\nc","-20"\r\n')
    expect(recordsCsv([{ record: '=SUM(A1:A2)', temperature: '-1+2' }], [columns[0], columns[2]], false))
      .toBe('\uFEFF"\'=SUM(A1:A2)","\'-1+2"\r\n')
  })
})
