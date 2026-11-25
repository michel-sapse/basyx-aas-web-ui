import { parseAbsoluteDate } from './timeRange'

export type TimePoint = { date: string, hour: string, minute: string, second: string, millisecond: string, period: string }
export type RecordRange = { start: string, end: string }
export type QuickRange = 'Today' | 'Yesterday' | 'Last 24 hours' | 'Last 7 days' | 'Last 30 days' | 'This month' | 'Last month' | 'Custom range'

export const QUICK_RANGES: QuickRange[] = ['Today', 'Yesterday', 'Last 24 hours', 'Last 7 days', 'Last 30 days', 'This month', 'Last month', 'Custom range']
export const DEFAULT_START_TIME = '0001-01-01T00:00:00.000Z'
export const DEFAULT_END_TIME = '9999-12-31T23:59:59.999Z'

// AAS repositories can normalize xs:dateTime defaults by omitting zero fractions.
export function isUnselectedTime (value: string, endpoint: 'start' | 'end'): boolean {
  return endpoint === 'start'
    ? /^0001-01-01T00:00:00(?:\.0+)?Z$/.test(value)
    : /^9999-12-31T23:59:59(?:\.(?:0+|9+))?Z$/.test(value)
}

export function dateTimeArgument (name: 'StartTime' | 'EndTime', value: string) {
  return { value: { modelType: 'Property', idShort: name, valueType: 'xs:dateTime', value,
    semanticId: { type: 'ExternalReference', keys: [{ type: 'GlobalReference', value: `https://admin-shell.io/idta/TimeSeries/Segment/${name}/1/1` }] },
  } }
}

export function offsetLabel (minutes: number): string {
  const absolute = Math.abs(minutes)
  return `UTC${minutes < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

export function validOffset (minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= -720 && minutes <= 840 && minutes % 15 === 0
}

export function emptyTimePoint (end = false): TimePoint {
  return { date: '', hour: end ? '11' : '12', minute: end ? '59' : '00', second: end ? '59' : '00', millisecond: end ? '999' : '000', period: end ? 'PM' : 'AM' }
}

export function parseDateInput (value: string): string | null {
  let key = value.trim()
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(key)
  if (match) {
    key = `${match[3]}-${String(months.indexOf(match[1]!.toLowerCase()) + 1).padStart(2, '0')}-${match[2]!.padStart(2, '0')}`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return null
  }
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year!, month! - 1, day!)
  date.setUTCHours(0, 0, 0, 0)
  return year! >= 1 && date.toISOString().slice(0, 10) === key ? key : null
}

export function formatRangeDate (value: string, year = true): string {
  const key = parseDateInput(value)
  if (!key) {
    return value
  }
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }).format(new Date(`${key}T00:00:00Z`))
}

export function pointError (point: TimePoint): string | null {
  if (!parseDateInput(point.date)) {
    return 'Enter a valid date, such as Nov 19, 2026 or 2026-11-19.'
  }
  for (const [field, min, max, digits] of [['hour', 1, 12, 2], ['minute', 0, 59, 2], ['second', 0, 59, 2], ['millisecond', 0, 999, 3]] as const) {
    const value = point[field]
    if (!/^\d+$/.test(value) || value.length > digits || Number(value) < min || Number(value) > max) {
      return `Enter a valid ${field} (${min}–${max}).`
    }
  }
  return ['AM', 'PM'].includes(point.period.toUpperCase()) ? null : 'Select AM or PM.'
}

export function pointToUtc (point: TimePoint, offset: number): string {
  const error = pointError(point)
  if (error || !validOffset(offset)) {
    throw new RangeError(error || 'Select a valid fixed offset.')
  }
  const [year, month, day] = parseDateInput(point.date)!.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year!, month! - 1, day!)
  date.setUTCHours(Number(point.hour) % 12 + (point.period.toUpperCase() === 'PM' ? 12 : 0), Number(point.minute), Number(point.second), Number(point.millisecond))
  const utc = new Date(date.getTime() - offset * 60_000).toISOString()
  if (!/^\d{4}-/.test(utc) || utc.startsWith('0000-')) {
    throw new RangeError('The UTC timestamp must fall within years 0001–9999.')
  }
  return utc
}

export function pointFromUtc (value: string, offset: number): TimePoint {
  const parsed = parseAbsoluteDate(value)
  if (!parsed || !validOffset(offset)) {
    throw new RangeError('Enter a valid timestamp and fixed offset.')
  }
  const date = new Date(parsed.getTime() + offset * 60_000)
  const hour = date.getUTCHours()
  return { date: date.toISOString().slice(0, 10), hour: String(hour % 12 || 12).padStart(2, '0'), minute: String(date.getUTCMinutes()).padStart(2, '0'), second: String(date.getUTCSeconds()).padStart(2, '0'), millisecond: String(date.getUTCMilliseconds()).padStart(3, '0'), period: hour < 12 ? 'AM' : 'PM' }
}

export function normalizeRecordRange (first: string, second: string): RecordRange {
  return Date.parse(first) <= Date.parse(second) ? { start: first, end: second } : { start: second, end: first }
}

export function recordRangeValid (start: unknown, end: unknown): boolean {
  return typeof start === 'string' && typeof end === 'string' && !isUnselectedTime(start, 'start') && !isUnselectedTime(end, 'end')
    && [start, end].every(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && parseAbsoluteDate(value)?.toISOString() === value)
    && Date.parse(start) <= Date.parse(end)
}

export function formatRangeTimestamp (value: string, offset: number): string {
  const point = pointFromUtc(value, offset)
  const hour = Number(point.hour) % 12 + (point.period === 'PM' ? 12 : 0)
  return `${formatRangeDate(point.date)}, ${String(hour).padStart(2, '0')}:${point.minute}:${point.second}.${point.millisecond}`
}

export function rangeDuration (milliseconds: number): string {
  let remaining = Math.max(0, milliseconds)
  const parts: string[] = []
  for (const [size, label] of [[86_400_000, 'day'], [3_600_000, 'hour'], [60_000, 'minute'], [1000, 'second'], [1, 'ms']] as const) {
    const value = Math.floor(remaining / size)
    remaining %= size
    if (value) {
      parts.push(`${value} ${label}${label === 'ms' || value === 1 ? '' : 's'}`)
    }
  }
  return parts.slice(0, 2).join(' ') || '0 seconds'
}

export function quickRecordRange (preset: QuickRange, offset: number, now = new Date()): RecordRange | null {
  if (preset === 'Custom range') {
    return null
  }
  if (!validOffset(offset) || !Number.isFinite(now.getTime())) {
    throw new RangeError('Select a valid fixed offset and date.')
  }
  const local = new Date(now.getTime() + offset * 60_000)
  const midnight = new Date(local)
  midnight.setUTCHours(0, 0, 0, 0)
  let start = midnight.getTime() - offset * 60_000
  let end = now.getTime()
  if (preset === 'Yesterday') {
    end = start - 1
    midnight.setUTCDate(midnight.getUTCDate() - 1)
    start = midnight.getTime() - offset * 60_000
  } else if (preset.startsWith('Last ') && preset !== 'Last month') {
    const days = preset === 'Last 24 hours' ? 1 : (preset === 'Last 7 days' ? 7 : 30)
    start = end - days * 86_400_000
  } else if (preset === 'This month' || preset === 'Last month') {
    midnight.setUTCDate(1)
    if (preset === 'Last month') {
      end = midnight.getTime() - offset * 60_000 - 1
      midnight.setUTCMonth(midnight.getUTCMonth() - 1)
    }
    start = midnight.getTime() - offset * 60_000
  }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}
