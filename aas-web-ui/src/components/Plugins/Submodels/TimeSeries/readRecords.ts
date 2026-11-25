import type { ResolvedTimeRange } from './timeRange'
import { dateTimeArgument } from './fixedOffsetRange'

export const READ_RECORDS_SEMANTIC_ID = 'urn:basyx:timeseries:read-records:1'

type OperationVariable = { value: { modelType: string, idShort: string, valueType: string, value: string } }

export function readRecordsOperationPath (submodel: any, segment: any): string | null {
  const reference = segment?.value?.find((element: any) => element.idShort === 'ReadRecordsOperation' && element.modelType === 'ReferenceElement')
  const keys = reference?.value?.keys
  const operationKey = keys?.at(-1)
  if (operationKey?.type !== 'Operation') {
    return null
  }
  const operation = submodel?.submodelElements?.find((element: any) => element.modelType === 'Operation'
    && element.idShort === operationKey.value
    && element.semanticId?.keys?.some((key: any) => key.value === READ_RECORDS_SEMANTIC_ID))
  if (!operation || !submodel.path || (submodel.id && keys[0]?.value !== submodel.id)) {
    return null
  }
  return operation.path || `${submodel.path}/submodel-elements/${encodeURIComponent(operation.idShort)}`
}

export function readRecordsRequest (range: ResolvedTimeRange, fields: string[]): string {
  return JSON.stringify({
    inputArguments: [
      dateTimeArgument('StartTime', new Date(range.startMs).toISOString()),
      // Visualization ranges are half-open; the operation's EndTime is inclusive.
      dateTimeArgument('EndTime', new Date(range.stopMs - 1).toISOString()),
      { value: { modelType: 'Property', idShort: 'Fields', valueType: 'xs:string', value: JSON.stringify(fields) } },
    ],
    timeout: 'PT30S',
  })
}

export function readRecordsDatasets (result: any, fields: string[]): Array<Array<{ time: string, value: number }>> {
  if (result?.executionState !== 'Completed' || result?.success !== true) {
    throw new Error('ReadRecords did not complete successfully.')
  }
  const output = result.outputArguments?.find((argument: OperationVariable) => argument.value?.idShort === 'Records')
  const records: unknown = JSON.parse(output?.value?.value ?? 'null')
  if (!Array.isArray(records)) {
    throw new TypeError('ReadRecords returned an invalid Records payload.')
  }
  return fields.map(field => records.flatMap(record => {
    if (!record || typeof record.time !== 'string' || !Number.isFinite(Date.parse(record.time))) {
      throw new Error('ReadRecords returned an invalid timestamp.')
    }
    if (record[field] === undefined || record[field] === null) {
      return []
    }
    if (typeof record[field] !== 'number' || !Number.isFinite(record[field])) {
      throw new TypeError('ReadRecords returned an invalid value.')
    }
    return [{ time: record.time, value: record[field] }]
  }))
}
