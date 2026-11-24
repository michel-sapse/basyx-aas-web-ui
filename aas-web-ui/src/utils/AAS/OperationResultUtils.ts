export type OperationResultRow = {
  path: string
  value: string
  valueType: string
}

// Only pivot uniform collections of scalar Properties; all other AAS shapes
// retain the generic, lossless element/value view.
export function operationRecordTable (element: any): { headers: { title: string, key: string }[], items: Record<string, string>[] } | undefined {
  if (element?.modelType !== 'SubmodelElementCollection' || !Array.isArray(element.value) || element.value.length === 0) {
    return
  }
  const records = element.value
  if (!records.every((record: any) => record?.modelType === 'SubmodelElementCollection' && Array.isArray(record.value) && record.value.length > 0)) {
    return
  }
  const fields = records[0].value
  if (!fields.every((field: any) => field?.modelType === 'Property' && typeof field.idShort === 'string' && field.idShort.length > 0)) {
    return
  }
  const names = fields.map((field: any) => field.idShort) as string[]
  if (new Set(names).size !== names.length) {
    return
  }
  if (!records.every((record: any) => record.value.length === names.length && names.every((name, index) => {
    const matches = record.value.filter((field: any) => field?.idShort === name)
    return matches.length === 1 && matches[0].modelType === 'Property' && matches[0].valueType === fields[index].valueType
      && (matches[0].value == null || ['string', 'number', 'boolean'].includes(typeof matches[0].value))
  }))) {
    return
  }
  return {
    headers: [{ title: 'Record', key: 'record' }, ...names.map((name, index) => ({ title: `${name} (${fields[index].valueType})`, key: `field${index}` }))],
    items: records.map((record: any, index: number) => Object.fromEntries([
      ['record', record.idShort || String(index + 1)],
      ...names.map((name, fieldIndex) => {
        const value = record.value.find((field: any) => field.idShort === name).value
        return [`field${fieldIndex}`, value == null ? '(no value)' : String(value)]
      }),
    ])),
  }
}

// Invocation results have no repository paths. Read their values without fetching
// or persisting anything, retaining list indexes and the original lexical values.
export function operationResultRows (element: any, path = element?.idShort || 'Result'): OperationResultRow[] {
  if (['SubmodelElementCollection', 'SubmodelElementList'].includes(element?.modelType)) {
    if (!element.value?.length) {
      return [{ path, value: '(empty)', valueType: element.modelType }]
    }
    return element.value.flatMap((child: any, index: number) => operationResultRows(
      child,
      element.modelType === 'SubmodelElementList'
        ? `${path}[${index}]`
        : `${path}.${child.idShort || `[${index}]`}`,
    ))
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
