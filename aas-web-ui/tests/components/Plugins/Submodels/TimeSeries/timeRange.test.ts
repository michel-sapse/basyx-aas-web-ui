import { describe, expect, it } from 'vitest'
import {
  filterTimeSeriesData,
  findLatestTimestamp,
  interpolateFluxTimeRange,
  resolveTimeRange,
  type TimeRangeSelection,
  toApexTimeRange,
  validateTimeRangeSelection,
} from '@/components/Plugins/Submodels/TimeSeries/timeRange'

describe('Time Series time-range utilities', () => {
  const stop = new Date('2026-05-13T19:16:00.000Z')

  it.each([
    ['2026-11-05', '2026-11-09'],
    ['2026-11-09', '2026-11-05'],
  ])('resolves calendar dates in either order', (start, stop) => {
    const range = resolveTimeRange({ mode: 'absolute', start, stop, calendar: true })
    expect(range.start).toBe(new Date(2026, 10, 5).toISOString())
    expect(range.stop).toBe(new Date(2026, 10, 10).toISOString())
    expect(range.stopExclusive).toBe(true)
  })

  it.each([
    ['2026-11-05', '2026-11-05', 1],
    ['2026-12-31', '2027-01-01', 2],
    ['2026-01-31', '2026-02-01', 2],
  ])('includes entire days across calendar boundaries', (start, stop, days) => {
    const range = resolveTimeRange({ mode: 'absolute', start, stop, calendar: true })
    expect(range.durationMs).toBe(days * 86_400_000)
    expect(filterTimeSeriesData([[
      { time: range.start, value: 1 },
      { time: new Date(range.stopMs - 1).toISOString(), value: 2 },
      { time: range.stop, value: 3 },
    ]], range)).toEqual([[
      { time: range.start, value: 1 },
      { time: new Date(range.stopMs - 1).toISOString(), value: 2 },
    ]])
  })

  it.each([['2026-03-29', 23], ['2026-10-25', 25]])('uses local midnight across DST on %s', (date, hours) => {
    const originalTimezone = process.env.TZ
    process.env.TZ = 'Europe/Berlin'
    try {
      expect(resolveTimeRange({ mode: 'absolute', start: date, stop: date, calendar: true }).durationMs).toBe(hours * 3_600_000)
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTimezone
      }
    }
  })

  it('rejects unfinished and invalid calendar selections', () => {
    expect(validateTimeRangeSelection({ mode: 'absolute', start: '2026-11-05', stop: '', calendar: true })).toContain('both')
    expect(validateTimeRangeSelection({ mode: 'absolute', start: '2026-02-30', stop: '2026-03-01', calendar: true })).toContain('valid start')
  })

  it.each([
    ['milliseconds', 500, 500],
    ['seconds', 2, 2000],
    ['minutes', 3, 180_000],
    ['hours', 4, 14_400_000],
    ['days', 2, 172_800_000],
    ['weeks', 2, 1_209_600_000],
  ] as const)('resolves %s relative ranges', (unit, value, durationMs) => {
    const range = resolveTimeRange({ mode: 'relative', value, unit }, stop)

    expect(range.stop).toBe(stop.toISOString())
    expect(range.durationMs).toBe(durationMs)
  })

  it('subtracts months using calendar boundaries', () => {
    const range = resolveTimeRange(
      { mode: 'relative', value: 1, unit: 'months' },
      new Date(2024, 2, 31, 12),
    )
    const start = new Date(range.start)

    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2024, 1, 29])
  })

  it('subtracts years using calendar boundaries', () => {
    const range = resolveTimeRange(
      { mode: 'relative', value: 1, unit: 'years' },
      new Date(2024, 1, 29, 12),
    )
    const start = new Date(range.start)

    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2023, 1, 28])
  })

  it('interprets absolute datetime inputs in the browser timezone and serializes UTC', () => {
    const selection: TimeRangeSelection = {
      mode: 'absolute',
      start: '2026-05-13T18:00',
      stop: '2026-05-13T20:00',
    }

    const range = resolveTimeRange(selection)

    expect(range.start).toBe(new Date(selection.start).toISOString())
    expect(range.stop).toBe(new Date(selection.stop).toISOString())
    expect(range.durationMs).toBe(7_200_000)
  })

  it.each([
    [{ mode: 'relative', value: 0, unit: 'minutes' }, 'greater than zero'],
    [{ mode: 'relative', value: 1.5, unit: 'months' }, 'whole numbers'],
    [{ mode: 'relative', value: 1, unit: 'fortnights' }, 'supported time unit'],
    [{ mode: 'relative', value: Number.MAX_VALUE, unit: 'milliseconds' }, 'supported date range'],
    [{ mode: 'absolute', start: '', stop: '' }, 'both a start and an end'],
    [{ mode: 'absolute', start: '2026-02-30T12:00', stop: '2026-03-01T12:00' }, 'valid start and end'],
    [{ mode: 'absolute', start: '2026-05-14T00:00', stop: '2026-05-13T00:00' }, 'before the end'],
    [{ mode: 'unexpected', start: '2026-05-13T00:00', stop: '2026-05-14T00:00' }, 'valid time range mode'],
    [null, 'valid time range'],
  ] as const)('validates invalid selections', (selection, message) => {
    expect(validateTimeRangeSelection(selection as TimeRangeSelection)).toContain(message)
    expect(() => resolveTimeRange(selection as TimeRangeSelection, stop)).toThrow(message)
  })

  it('rejects local date-times that do not exist during a DST transition', () => {
    const originalTimezone = process.env.TZ
    process.env.TZ = 'Europe/Berlin'

    try {
      const selection: TimeRangeSelection = {
        mode: 'absolute',
        start: '2026-03-29T02:30',
        stop: '2026-03-29T04:00',
      }

      expect(validateTimeRangeSelection(selection)).toContain('valid start and end')
      expect(() => resolveTimeRange(selection)).toThrow('valid start and end')
    } finally {
      if (originalTimezone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTimezone
      }
    }
  })

  it('interpolates supported Flux variables without touching other identifiers', () => {
    const range = resolveTimeRange({ mode: 'relative', value: 1, unit: 'minutes' }, stop)
    const query = [
      'from(bucket: "basyx")',
      '  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)',
      '  |> aggregateWindow(every: v.windowPeriod, fn: mean)',
      'v.custom v.timeRangeStartSuffix v.timeRangeStart',
    ].join('\n')

    const interpolated = interpolateFluxTimeRange(query, range)

    expect(interpolated).toContain(`range(start: ${range.start}, stop: ${range.stop})`)
    expect(interpolated).toContain('aggregateWindow(every: 167ms')
    expect(interpolated).toContain('v.custom v.timeRangeStartSuffix')
    expect(interpolated.match(new RegExp(range.start, 'g'))).toHaveLength(2)
  })

  it('leaves hard-coded Flux ranges unchanged', () => {
    const range = resolveTimeRange({ mode: 'relative', value: 1, unit: 'minutes' }, stop)
    const query = 'from(bucket: "basyx") |> range(start: -10m)'

    expect(interpolateFluxTimeRange(query, range)).toBe(query)
  })

  it('finds the latest point and filters every dataset inclusively', () => {
    const datasets = [
      [
        { time: '2026-05-13T19:14:59.000Z', value: 1 },
        { time: '2026-05-13T19:15:00.000Z', value: 2 },
        { time: '2026-05-13T19:16:00.000Z', value: 3 },
      ],
      [{ time: 'invalid', value: 4 }],
    ]
    const range = resolveTimeRange({ mode: 'relative', value: 1, unit: 'minutes' }, stop)

    expect(findLatestTimestamp(datasets)?.toISOString()).toBe('2026-05-13T19:16:00.000Z')
    expect(filterTimeSeriesData(datasets, range)).toEqual([
      [
        { time: '2026-05-13T19:15:00.000Z', value: 2 },
        { time: '2026-05-13T19:16:00.000Z', value: 3 },
      ],
      [],
    ])
  })

  it('finds the latest point in datasets larger than the function argument limit', () => {
    const repeatedPoint = { time: '2026-05-13T19:15:00.000Z', value: 1 }
    const dataset = Array.from({ length: 200_000 }, () => repeatedPoint)
    dataset.push({ time: '2026-05-13T19:16:00.000Z', value: 2 })

    expect(findLatestTimestamp([dataset])?.toISOString()).toBe('2026-05-13T19:16:00.000Z')
  })

  it('converts relative and absolute ranges to ApexCharts options', () => {
    const relative = resolveTimeRange({ mode: 'relative', value: 5, unit: 'minutes' }, stop)
    const absolute = resolveTimeRange({
      mode: 'absolute',
      start: '2026-05-13T18:00:00.000Z',
      stop: '2026-05-13T19:00:00.000Z',
    })

    expect(toApexTimeRange(relative)).toEqual({ range: undefined, min: relative.startMs, max: relative.stopMs })
    expect(toApexTimeRange(absolute)).toEqual({ range: undefined, min: absolute.startMs, max: absolute.stopMs })
  })
})
