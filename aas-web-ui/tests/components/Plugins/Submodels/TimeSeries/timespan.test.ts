import { describe, expect, it } from 'vitest'
import { dateTimeTimespan } from '@/components/Plugins/Submodels/TimeSeries/timespan'

describe('Timespan date/time boundaries', () => {
  it('uses the exact selected minutes in either order, including the same day', () => {
    const first = { date: '2026-11-24', time: '09:15' }
    const second = { date: '2026-11-24', time: '17:45' }
    const expected = { min: new Date('2026-11-24T09:15').toISOString(), max: new Date('2026-11-24T17:45').toISOString() }
    expect(dateTimeTimespan(first, second)).toEqual(expected)
    expect(dateTimeTimespan(second, first)).toEqual(expected)
    expect(dateTimeTimespan(first, first)).toEqual({ min: expected.min, max: expected.min })
  })

  it.each(['24:00', '09:60', '09:15:30'])('rejects unsupported clock value %s', time => {
    expect(() => dateTimeTimespan({ date: '2026-11-24', time }, { date: '2026-11-24', time: '12:00' })).toThrow('valid local time')
  })

  it('converts valid times across DST and rejects a time skipped by the clocks', () => {
    const originalTimezone = process.env.TZ
    process.env.TZ = 'Europe/Berlin'
    try {
      expect(dateTimeTimespan({ date: '2026-03-29', time: '01:30' }, { date: '2026-03-29', time: '03:30' })).toEqual({ min: '2026-03-29T00:30:00.000Z', max: '2026-03-29T01:30:00.000Z' })
      expect(() => dateTimeTimespan({ date: '2026-03-29', time: '02:30' }, { date: '2026-03-29', time: '03:30' })).toThrow('clocks change')
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTimezone
      }
    }
  })
})
