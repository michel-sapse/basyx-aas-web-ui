import { describe, expect, it } from 'vitest'
import { convertPointHourFormat, emptyTimePoint, formatRangeTimestamp, pointError, pointFromUtc, pointToUtc } from '@/components/Plugins/Submodels/TimeSeries/fixedOffsetRange'

describe('time format conversion', () => {
  it.each([['00', '12', 'AM'], ['12', '12', 'PM'], ['23', '11', 'PM'], ['01', '01', 'AM']])('preserves hour %s and sub-second precision', (hour, hour12, period) => {
    const instant = '2026-11-25T' + hour + ':15:43.815Z'
    const point24 = pointFromUtc(instant, 0, '24')
    const point12 = convertPointHourFormat(point24, '24', '12')
    expect(point12.hour).toBe(hour12)
    expect(point12.period).toBe(period)
    expect(point12.millisecond).toBe('815')
    expect(pointToUtc(point12, 0, '12')).toBe(instant)
    expect(pointToUtc(convertPointHourFormat(point12, '12', '24'), 0, '24')).toBe(instant)
    expect(formatRangeTimestamp(instant, 0, '12')).toContain(hour12 + ':15:43.815 ' + period)
    expect(formatRangeTimestamp(instant, 0, '24')).toContain(hour + ':15:43.815')
    expect(formatRangeTimestamp(instant, 0, '24')).not.toMatch(/AM|PM/)
  })

  it('preserves fractional offsets and year rollover', () => {
    const instant = '2026-12-31T20:30:43.815Z'
    const point24 = pointFromUtc(instant, 345, '24')
    expect(point24.date).toBe('2027-01-01')
    expect(point24.hour).toBe('02')
    expect(pointToUtc(convertPointHourFormat(point24, '24', '12'), 345, '12')).toBe(instant)
  })

  it('validates 24-hour bounds and preserves invalid input when switching formats', () => {
    const point = { ...emptyTimePoint(false, '24'), date: '2026-11-25' }
    expect(point.hour).toBe('00')
    expect(emptyTimePoint(true, '24').hour).toBe('23')
    expect(pointError(point, '24')).toBeNull()
    expect(pointError({ ...point, hour: '24' }, '24')).toContain('0–23')
    expect(() => pointToUtc({ ...point, hour: '24' }, 0, '24')).toThrow()
    expect(convertPointHourFormat({ ...point, hour: 'invalid' }, '24', '12').hour).toBe('invalid')
    expect(convertPointHourFormat({ ...point, date: '' }, '24', '12')).toMatchObject({ date: '', hour: '12', period: 'AM' })
  })
})
