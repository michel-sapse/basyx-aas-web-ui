import { describe, expect, it } from 'vitest'
import { emptyTimePoint, formatRangeTimestamp, isUnselectedTime, normalizeRecordRange, offsetLabel, parseDateInput, pointError, pointFromUtc, pointToUtc, quickRecordRange, rangeDuration, recordRangeValid, validOffset } from '@/components/Plugins/Submodels/TimeSeries/fixedOffsetRange'

const reference = { date: '2026-11-19', hour: '12', minute: '00', second: '43', millisecond: '815', period: 'PM' }

describe('fixed-offset ReadRecords ranges', () => {
  it('recognizes unselected defaults with normalized fractional precision', () => {
    for (const value of ['0001-01-01T00:00:00Z', '0001-01-01T00:00:00.000Z']) {
      expect(isUnselectedTime(value, 'start')).toBe(true)
    }
    for (const value of ['9999-12-31T23:59:59Z', '9999-12-31T23:59:59.999Z']) {
      expect(isUnselectedTime(value, 'end')).toBe(true)
    }
    expect(isUnselectedTime('2026-11-25T12:00:00.000Z', 'start')).toBe(false)
  })
  it('preserves the reference seconds and milliseconds with a six-day elapsed duration', () => {
    const start = pointToUtc(reference, 60)
    const end = pointToUtc({ ...reference, date: '2026-11-25' }, 60)
    expect(start).toBe('2026-11-19T11:00:43.815Z')
    expect(end).toBe('2026-11-25T11:00:43.815Z')
    expect(pointFromUtc(start, 60)).toEqual(reference)
    expect(formatRangeTimestamp(start, 60)).toBe('Nov 19, 2026, 12:00:43.815')
    expect(rangeDuration(Date.parse(end) - Date.parse(start))).toBe('6 days')
    expect(normalizeRecordRange(end, start)).toEqual({ start, end })
  })

  it.each([['AM', '00'], ['PM', '12']])('converts 12 %s correctly', (period, hour) => {
    expect(pointToUtc({ ...reference, period }, 0)).toBe('2026-11-19T' + hour + ':00:43.815Z')
  })

  it.each([[-210, 'UTC-03:30'], [345, 'UTC+05:45'], [765, 'UTC+12:45'], [0, 'UTC+00:00']])('preserves instants in offset %s', (offset, label) => {
    const instant = '2026-12-31T23:59:59.999Z'
    expect(offsetLabel(offset)).toBe(label)
    expect(pointToUtc(pointFromUtc(instant, offset), offset)).toBe(instant)
    expect(validOffset(offset)).toBe(true)
  })

  it('rolls dates across months/years and remains fixed across daylight-saving dates', () => {
    expect(pointFromUtc('2026-12-31T23:59:59.999Z', 345).date).toBe('2027-01-01')
    expect(pointFromUtc('2026-01-01T01:00:00.000Z', -210).date).toBe('2025-12-31')
    const first = pointToUtc({ ...emptyTimePoint(), date: '2026-03-29' }, 60)
    const second = pointToUtc({ ...emptyTimePoint(), date: '2026-03-30' }, 60)
    expect(Date.parse(second) - Date.parse(first)).toBe(86_400_000)
  })

  it('orders complete same-day pairs and permits equal timestamps', () => {
    const start = pointToUtc({ ...reference, hour: '08', period: 'AM' }, 60)
    const end = pointToUtc(reference, 60)
    expect(normalizeRecordRange(end, start)).toEqual({ start, end })
    expect(recordRangeValid(start, start)).toBe(true)
    expect(recordRangeValid(end, start)).toBe(false)
  })

  it('rejects impossible dates, invalid components and offsets without losing valid zero values', () => {
    expect(parseDateInput('Nov 19, 2026')).toBe('2026-11-19')
    for (const date of ['2026-02-30', '2026-13-01', '0000-01-01', '2/3/2026']) {
      expect(parseDateInput(date)).toBeNull()
    }
    for (const value of [{ hour: '00' }, { minute: '60' }, { second: '60' }, { millisecond: '1000' }, { period: 'XX' }, { date: '' }]) {
      expect(pointError({ ...reference, ...value })).toBeTruthy()
      expect(() => pointToUtc({ ...reference, ...value }, 60)).toThrow()
    }
    for (const offset of [-721, 841, 61, 0.5, Number.NaN]) {
      expect(validOffset(offset)).toBe(false)
    }
    expect(pointError({ ...emptyTimePoint(), date: '2026-01-01' })).toBeNull()
    expect(recordRangeValid('2026-11-19T00:00:00Z', '2026-11-19T00:00:00Z')).toBe(false)
    expect(() => pointToUtc({ ...emptyTimePoint(), date: '0001-01-01' }, 60)).toThrow()
  })

  it.each([
    ['Today', '2026-11-24T23:00:00.000Z', '2026-11-25T11:00:43.815Z'],
    ['Yesterday', '2026-11-23T23:00:00.000Z', '2026-11-24T22:59:59.999Z'],
    ['Last 24 hours', '2026-11-24T11:00:43.815Z', '2026-11-25T11:00:43.815Z'],
    ['Last 7 days', '2026-11-18T11:00:43.815Z', '2026-11-25T11:00:43.815Z'],
    ['Last 30 days', '2026-10-26T11:00:43.815Z', '2026-11-25T11:00:43.815Z'],
    ['This month', '2026-10-31T23:00:00.000Z', '2026-11-25T11:00:43.815Z'],
    ['Last month', '2026-09-30T23:00:00.000Z', '2026-10-31T22:59:59.999Z'],
  ] as const)('defines %s in the chosen fixed offset', (preset, start, end) => {
    expect(quickRecordRange(preset, 60, new Date('2026-11-25T11:00:43.815Z'))).toEqual({ start, end })
  })

  it('handles preset year rollover, leap months, negative offsets and Custom range', () => {
    expect(quickRecordRange('Last month', -210, new Date('2027-01-01T15:00:00Z'))).toEqual({ start: '2026-12-01T03:30:00.000Z', end: '2027-01-01T03:29:59.999Z' })
    expect(quickRecordRange('Last month', 345, new Date('2028-03-01T12:00:00Z'))).toEqual({ start: '2028-01-31T18:15:00.000Z', end: '2028-02-29T18:14:59.999Z' })
    expect(quickRecordRange('Custom range', 60)).toBeNull()
  })
})
