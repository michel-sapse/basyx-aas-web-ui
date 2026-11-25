export interface ResultReference {
  type?: string
  keys?: { type?: string, value: string }[]
}

export interface OperationResultElement {
  modelType?: string
  idShort?: string
  displayName?: { language: string, text: string }[]
  valueType?: string
  value?: unknown
  min?: string | null
  max?: string | null
  semanticId?: ResultReference
}

export interface OperationResultArgument {
  value: OperationResultElement
}

export interface OperationResultDefinition extends OperationResultElement {
  inputVariables?: OperationResultArgument[]
  outputVariables?: OperationResultArgument[]
  inoutputVariables?: OperationResultArgument[]
}

export interface OperationInvocationResult {
  executionState?: string
  success?: boolean
  outputArguments?: OperationResultArgument[]
  inoutputArguments?: OperationResultArgument[]
}

export function isResultElement (value: unknown): value is OperationResultElement {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function resultChildren (element: OperationResultElement): OperationResultElement[] | undefined {
  return Array.isArray(element.value) && element.value.every(isResultElement) ? element.value : undefined
}
