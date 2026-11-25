import { parseAbsoluteDate, type ResolvedTimeRange, resolveTimeRange } from './timeRange'

export const TIMESPAN_SEMANTIC_ID = 'https://admin-shell.io/idta/TimeSeries/Timespan/1/1'
export const DEFAULT_TIMESPAN_MIN = '0001-01-01T00:00:00Z'
export const DEFAULT_TIMESPAN_MAX = '9999-12-31T23:59:59Z'

export function isTimespanRange (element: any): boolean {
  return element?.modelType === 'Range' && element.valueType === 'xs:dateTime'
    && element.semanticId?.keys?.some((key: any) => key.value === TIMESPAN_SEMANTIC_ID)
}

export function timespanHasBounds (element: any): boolean {
  return isTimespanRange(element) && typeof element.min === 'string' && typeof element.max === 'string'
    && element.min !== DEFAULT_TIMESPAN_MIN && element.max !== DEFAULT_TIMESPAN_MAX
    && Number.isFinite(Date.parse(element.min)) && Number.isFinite(Date.parse(element.max))
    && Date.parse(element.min) <= Date.parse(element.max)
}

export function timespanBounds (range: ResolvedTimeRange): { min: string, max: string } {
  const max = new Date(range.stopMs - 1).toISOString().replace('Z', '999999Z')
  return { min: range.start, max }
}

export function calendarTimespan (start: string, stop: string): { min: string, max: string } {
  return timespanBounds(resolveTimeRange({ mode: 'absolute', start, stop, calendar: true }))
}

export type CalendarEndpoint = { date: string, time: string }

export function dateTimeTimespan (first: CalendarEndpoint, second: CalendarEndpoint): { min: string, max: string } {
  const dates = [first, second].map(endpoint => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endpoint.time)
    ? parseAbsoluteDate(`${endpoint.date}T${endpoint.time}`)
    : null)
  if (dates.some(date => !date)) {
    throw new RangeError('Choose a valid local time. This time may not exist because the clocks change on this date.')
  }
  const ordered = dates.toSorted((a, b) => a!.getTime() - b!.getTime())
  return { min: ordered[0]!.toISOString(), max: ordered[1]!.toISOString() }
}

export function timespanArgument (range: ResolvedTimeRange) {
  return {
    value: {
      idShort: 'Timespan',
      description: [{ language: 'en', text: 'The valueType of the given timespan must match the valueType of the time properties of the segments.' }],
      semanticId: { type: 'ExternalReference', keys: [{ type: 'GlobalReference', value: TIMESPAN_SEMANTIC_ID }] },
      valueType: 'xs:dateTime',
      ...timespanBounds(range),
      modelType: 'Range',
    },
  }
}
