export type OperationResultRow = {
  path: string
  value: string
  valueType: string
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
