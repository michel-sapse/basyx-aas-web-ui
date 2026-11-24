import type { OperationInvocationResult, OperationResultDefinition, OperationResultElement } from '@/types/OperationResult'
import type { OperationPersistenceBoundary } from '@/types/OperationTree'
import { defineStore } from 'pinia'
import { useInfrastructureStore } from '@/store/InfrastructureStore'
import { canonicalTreeElementJson, resolveOperationLocator } from '@/utils/AAS/OperationTreeUtils'

type Snapshot = {
  definition: OperationResultDefinition
  result: OperationInvocationResult
  completedAt: string
}

// Deliberately in-memory only: operation results are not repository updates.
export const useOperationResultStore = defineStore('operationResults', () => {
  const infrastructureStore = useInfrastructureStore()
  const snapshots = ref<Record<string, Snapshot>>({})

  watch(() => infrastructureStore.getSelectedInfrastructureId, () => {
    snapshots.value = {}
  }, { flush: 'sync' })

  function remember (path: string, definition: OperationResultDefinition, result: OperationInvocationResult): void {
    if (!path) {
      return
    }
    snapshots.value[path] = {
      definition: JSON.parse(canonicalTreeElementJson(definition)),
      result: structuredClone(toRaw(result)),
      completedAt: new Date().toISOString(),
    }
  }

  function forget (path: string): void {
    delete snapshots.value[path]
  }

  function forOperation (path: string, definition: OperationResultDefinition): Snapshot | undefined {
    const snapshot = snapshots.value[path]
    if (!snapshot || canonicalTreeElementJson(definition) !== canonicalTreeElementJson(snapshot.definition)) {
      return
    }
    return snapshot
  }

  function forNode (boundary: OperationPersistenceBoundary, node: unknown): { element: OperationResultElement, completedAt: string } | undefined {
    const snapshot = snapshots.value[boundary.operationPath]
    const [direction, index, valueSegment, ...childLocator] = boundary.locator
    if (!snapshot || !['outputVariables', 'inoutputVariables'].includes(String(direction)) || typeof index !== 'number' || valueSegment !== 'value') {
      return
    }
    const definitionNode = resolveOperationLocator(snapshot.definition, boundary.locator)
    // A changed definition must not be confused with an earlier invocation.
    if (!definitionNode || canonicalTreeElementJson(node) !== canonicalTreeElementJson(definitionNode)) {
      return
    }
    const definedVariable = (direction === 'outputVariables' ? snapshot.definition.outputVariables : snapshot.definition.inoutputVariables)?.[index]?.value
    const argumentName = direction === 'outputVariables' ? 'outputArguments' : 'inoutputArguments'
    const argumentsArray = snapshot.result[argumentName]
    if (!Array.isArray(argumentsArray)) {
      return
    }
    // Match names rather than assuming the server returns variables in definition order.
    const matches = argumentsArray.filter(argument => argument?.value?.idShort === definedVariable?.idShort)
    if (matches.length !== 1) {
      return
    }
    const returned = matches[0].value
    const element = childLocator.length === 0 ? returned : resolveOperationLocator(returned, childLocator)
    if (!element) {
      return
    }
    return { element, completedAt: snapshot.completedAt }
  }

  return { remember, forget, forOperation, forNode }
})
