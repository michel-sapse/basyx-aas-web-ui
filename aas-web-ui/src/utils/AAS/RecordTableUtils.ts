export interface RecordColumn {
  key: string
  title: string
  valueType?: string
  unit?: string
}

export type RecordRow = Record<string, string>
export type RecordOperator = 'contains' | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
export interface RecordFilter {
  key: string
  operator: RecordOperator
  value: string
}
export interface RecordSort {
  key: string
  order?: 'asc' | 'desc' | boolean
}

const integerTypes = new Set(['integer', 'int', 'long', 'short', 'byte', 'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger', 'negativeInteger', 'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte'])

export function recordColumnKind (column: RecordColumn): 'number' | 'time' | 'text' {
  const type = column.valueType?.replace('xs:', '') ?? ''
  if (integerTypes.has(type) || ['decimal', 'double', 'float'].includes(type)) {
    return 'number'
  }
  if (['dateTime', 'dateTimeStamp'].includes(type)) {
    return 'time'
  }
  return 'text'
}

function comparable (value: string, column: RecordColumn): string | number | bigint | undefined {
  if (value === '(no value)') {
    return
  }
  const kind = recordColumnKind(column)
  if (kind === 'text') {
    return value.toLocaleLowerCase()
  }
  if (!value.trim()) {
    return
  }
  if (kind === 'time') {
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : undefined
  }
  if (integerTypes.has(column.valueType?.replace('xs:', '') ?? '')) {
    return /^[+-]?\d+$/.test(value) ? BigInt(value) : undefined
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function recordFilterError (filter: RecordFilter, columns: RecordColumn[]): string {
  const column = columns.find(column => column.key === filter.key)
  if (!column) {
    return 'Select a column.'
  }
  if (!filter.value.trim()) {
    return 'Enter a value.'
  }
  if (filter.operator !== 'contains' && comparable(filter.value, column) === undefined) {
    return recordColumnKind(column) === 'time' ? 'Enter a valid date-time with timezone.' : 'Enter a valid number for this column.'
  }
  if (recordColumnKind(column) === 'time' && !/(?:Z|[+-]\d{2}:\d{2})$/.test(filter.value)) {
    return 'Include Z or an explicit timezone offset.'
  }
  return ''
}

export function filterRecordRows (rows: RecordRow[], columns: RecordColumn[], search: string, filters: RecordFilter[]): RecordRow[] {
  const query = search.trim().toLocaleLowerCase()
  return rows.filter(row => (!query || columns.some(column => (row[column.key] ?? '').toLocaleLowerCase().includes(query)))
    && filters.every(filter => {
      const column = columns.find(column => column.key === filter.key)
      if (!column || recordFilterError(filter, columns)) {
        return false
      }
      const raw = row[filter.key] ?? ''
      if (filter.operator === 'contains') {
        return raw.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase())
      }
      const left = comparable(raw, column)
      const right = comparable(filter.value, column)
      if (left === undefined || right === undefined) {
        return false
      }
      switch (filter.operator) {
        case 'eq': { return left === right }
        case 'ne': { return left !== right }
        case 'gt': { return left > right }
        case 'gte': { return left >= right }
        case 'lt': { return left < right }
        case 'lte': { return left <= right }
        default: { return false }
      }
    }))
}

export function sortRecordRows (rows: RecordRow[], columns: RecordColumn[], sort: RecordSort[]): RecordRow[] {
  return rows.toSorted((left, right) => {
    for (const rule of sort) {
      const column = columns.find(column => column.key === rule.key)
      if (!column) {
        continue
      }
      const a = comparable(left[rule.key] ?? '', column)
      const b = comparable(right[rule.key] ?? '', column)
      if (a === undefined || b === undefined) {
        if (a !== b) {
          return a === undefined ? 1 : -1
        }
        continue
      }
      let comparison = 0
      if (typeof a === 'string' && typeof b === 'string') {
        comparison = a.localeCompare(b, undefined, { numeric: true })
      } else if (a !== b) {
        comparison = a < b ? -1 : 1
      }
      if (comparison) {
        return rule.order === 'desc' ? -comparison : comparison
      }
    }
    return 0
  })
}

function csvCell (value: string, numeric = false): string {
  // Escape spreadsheet formulas in text cells, while preserving negative numbers.
  const safe = !numeric && /^\s*[=+@\-\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function recordsCsv (rows: RecordRow[], columns: RecordColumn[], includeHeaders: boolean): string {
  const lines: string[] = []
  if (includeHeaders) {
    lines.push(columns.map(column => csvCell(`${column.title}${column.unit ? ` [${column.unit}]` : ''}`)).join(','))
  }
  for (const row of rows) {
    lines.push(columns.map(column => {
      const value = row[column.key] ?? ''
      return csvCell(value === '(no value)' ? '' : value, recordColumnKind(column) === 'number' && comparable(value, column) !== undefined)
    }).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
