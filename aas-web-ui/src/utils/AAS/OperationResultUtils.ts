import type { OperationResultElement } from '@/types/OperationResult'
import { resultChildren } from '@/types/OperationResult'

export type OperationResultRow = {
  path: string
  value: string
  valueType: string
}

// Only pivot uniform collections of scalar Properties; all other AAS shapes
// retain the generic, lossless element/value view.
export function operationRecordTable (element: OperationResultElement): { headers: { title: string, key: string }[], items: Record<string, string>[], fields: OperationResultElement[] } | undefined {
  const records = resultChildren(element)
  if (element.modelType !== 'SubmodelElementCollection' || !records?.length) {
    return
  }
  const recordFields = records.map(record => record.modelType === 'SubmodelElementCollection' ? resultChildren(record) : undefined)
  if (!recordFields.every((fields): fields is OperationResultElement[] => !!fields?.length)) {
    return
  }
  const fields = recordFields[0]
  if (!fields.every(field => field.modelType === 'Property' && typeof field.idShort === 'string' && field.idShort.length > 0)) {
    return
  }
  const names = fields.map(field => field.idShort!)
  if (new Set(names).size !== names.length) {
    return
  }
  if (!recordFields.every(record => record.length === names.length && names.every((name, index) => {
    const matches = record.filter(field => field.idShort === name)
    return matches.length === 1 && matches[0].modelType === 'Property' && matches[0].valueType === fields[index].valueType
      && (matches[0].value == null || ['string', 'number', 'boolean'].includes(typeof matches[0].value))
  }))) {
    return
  }
  return {
    fields,
    headers: [{ title: 'Record', key: 'record' }, ...names.map((name, index) => ({ title: `${name} (${fields[index].valueType})`, key: `field${index}` }))],
    items: records.map((record, index) => Object.fromEntries([
      ['record', record.idShort || String(index + 1)],
      ...names.map((name, fieldIndex) => {
        const value = recordFields[index].find(field => field.idShort === name)!.value
        return [`field${fieldIndex}`, value == null ? '(no value)' : String(value)]
      }),
    ])),
  }
}

// Invocation results have no repository paths. Read their values without fetching
// or persisting anything, retaining list indexes and the original lexical values.
export function operationResultRows (element: OperationResultElement, path = element?.idShort || 'Result'): OperationResultRow[] {
  if (['SubmodelElementCollection', 'SubmodelElementList'].includes(element?.modelType ?? '')) {
    const children = resultChildren(element)
    if (children?.length === 0 || element.value == null) {
      return [{ path, value: '(empty)', valueType: element.modelType ?? '' }]
    }
    if (children) {
      return children.flatMap((child, index) => operationResultRows(
        child,
        element.modelType === 'SubmodelElementList'
          ? `${path}[${index}]`
          : `${path}.${child.idShort || `[${index}]`}`,
      ))
    }
  }
  let value = element?.value
  if (element?.modelType === 'Range') {
    value = { min: element.min, max: element.max }
  } else if (value === undefined && element?.modelType !== 'Property') {
    value = element
  }
  return [{
    path,
    value: value === undefined || value === null ? '(no value)' : (typeof value === 'object' ? JSON.stringify(value) : String(value)),
    valueType: element?.valueType || element?.modelType || '',
  }]
}
