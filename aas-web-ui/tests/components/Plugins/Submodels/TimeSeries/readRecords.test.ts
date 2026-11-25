import { describe, expect, it } from 'vitest'
import { readRecordsDatasets, readRecordsRequest } from '@/components/Plugins/Submodels/TimeSeries/readRecords'
import { resolveTimeRange } from '@/components/Plugins/Submodels/TimeSeries/timeRange'

describe('ReadRecords operation contract', () => {
  it('passes ordered UTC boundaries and all selected fields', () => {
    const range = resolveTimeRange({ mode: 'absolute', start: '2026-11-09', stop: '2026-11-05', calendar: true })
    const request = JSON.parse(readRecordsRequest(range, ['pressure', 'rpm']))
    expect(request.inputArguments[0].value).toMatchObject({
      idShort: 'StartTime', modelType: 'Property', valueType: 'xs:dateTime', value: range.start,
      semanticId: { keys: [{ type: 'GlobalReference', value: 'https://admin-shell.io/idta/TimeSeries/Segment/StartTime/1/1' }] },
    })
    expect(request.inputArguments[1].value).toMatchObject({
      idShort: 'EndTime', modelType: 'Property', valueType: 'xs:dateTime', value: new Date(range.stopMs - 1).toISOString(),
    })
    expect(request.inputArguments[2].value.value).toBe('[' + '"pressure","rpm"' + ']')
    expect(request.inputArguments).toHaveLength(3)
  })

  it('maps completed operation records to independent datasets', () => {
    const records = [{ time: '2026-11-05T12:00:00Z', pressure: 24, rpm: 1200 }, { time: '2026-11-05T12:00:01Z', rpm: 1201 }]
    expect(readRecordsDatasets({ executionState: 'Completed', success: true, outputArguments: [
      { value: { idShort: 'Records', value: JSON.stringify(records) } },
    ] }, ['pressure', 'rpm'])).toEqual([
      [{ time: records[0]!.time, value: 24 }],
      [{ time: records[0]!.time, value: 1200 }, { time: records[1]!.time, value: 1201 }],
    ])
  })

  it('handles empty results and rejects failed or malformed results', () => {
    expect(readRecordsDatasets({ executionState: 'Completed', success: true, outputArguments: [{ value: { idShort: 'Records', value: '[]' } }] }, ['rpm'])).toEqual([[]])
    expect(() => readRecordsDatasets({ executionState: 'Failed', success: false }, ['rpm'])).toThrow('did not complete')
    expect(() => readRecordsDatasets({ executionState: 'Completed', success: true, outputArguments: [] }, ['rpm'])).toThrow('invalid Records')
  })
})
