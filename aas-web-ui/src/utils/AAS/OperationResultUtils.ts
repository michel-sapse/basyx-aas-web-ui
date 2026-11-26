import type { OperationResultElement } from '@/types/OperationResult'
import { resultChildren } from '@/types/OperationResult'

export type OperationResultRow = {
  path: string
  value: string
  valueType: string
}

function isScalarProperty (field: OperationResultElement): field is OperationResultElement & { idShort: string } {
  return field.modelType === 'Property' && typeof field.idShort === 'string' && field.idShort.length > 0
    && (field.value == null || ['string', 'number', 'boolean'].includes(typeof field.value))
}

// Pivot scalar record collections, including sparse records with different
// metrics. Preserve each record independently; never fill or aggregate values.
export function operationRecordTable (element: OperationResultElement, schema?: OperationResultElement[]): { headers: { title: string, key: string }[], items: Record<string, string>[], fields: OperationResultElement[], undeclaredFields: string[] } | undefined {
  const records = resultChildren(element)
  if (element.modelType !== 'SubmodelElementCollection' || !records) {
    return
  }
  if (records.length === 0 && !schema?.length) {
    return
  }
  const recordFields = records.map(record => record.modelType === 'SubmodelElementCollection' ? resultChildren(record) : undefined)
  if (!recordFields.every((fields): fields is OperationResultElement[] => !!fields?.length)) {
    return
  }
  const fieldDefinitions = new Map<string, OperationResultElement>()
  const valuesByRecord: Map<string, unknown>[] = []
  for (const record of recordFields) {
    const values = new Map<string, unknown>()
    for (const field of record) {
      if (!isScalarProperty(field) || values.has(field.idShort)) {
        return
      }
      const definition = fieldDefinitions.get(field.idShort)
      if (definition && (definition.valueType !== field.valueType
        || (definition.semanticId && field.semanticId && JSON.stringify(definition.semanticId) !== JSON.stringify(field.semanticId)))) {
        return
      }
      if (!definition || (!definition.semanticId && field.semanticId)) {
        fieldDefinitions.set(field.idShort, field)
      }
      values.set(field.idShort, field.value)
    }
    valuesByRecord.push(values)
  }
  const declared = new Map<string, OperationResultElement>()
  for (const field of schema ?? []) {
    if (!isScalarProperty(field) || !field.valueType || declared.has(field.idShort)) {
      return
    }
    declared.set(field.idShort, field)
  }
  const undeclaredFields = schema ? [...fieldDefinitions.keys()].filter(name => !declared.has(name)) : []
  const ordered = new Map(declared)
  for (const [name, field] of fieldDefinitions) {
    if (!ordered.has(name)) {
      ordered.set(name, field)
    }
  }
  const fields = [...ordered.values()]
  const names = [...ordered.keys()]
  return {
    fields,
    undeclaredFields,
    headers: [{ title: 'Record', key: 'record' }, ...names.map((name, index) => ({ title: `${name} (${fields[index].valueType})`, key: `field${index}` }))],
    items: records.map((record, index) => Object.fromEntries([
      ['record', record.idShort || String(index + 1)],
      ...names.map((name, fieldIndex) => {
        const value = valuesByRecord[index].get(name)
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
