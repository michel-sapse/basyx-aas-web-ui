import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useOperationResultStore } from '@/store/OperationResultStore'
import { decorateResolvedOperationNode } from '@/utils/AAS/OperationTreeUtils'

const infrastructureId = ref('one')
vi.mock('@/store/InfrastructureStore', () => ({
  useInfrastructureStore: () => ({
    get getSelectedInfrastructureId () {
      return infrastructureId.value
    },
  }),
}))

const records = { modelType: 'SubmodelElementCollection', idShort: 'Records', value: [] }
const definition = {
  modelType: 'Operation', idShort: 'ReadRecords',
  inputVariables: [{ value: { modelType: 'Property', idShort: 'StartTime', valueType: 'xs:dateTime', value: '2026-11-24T09:00:00Z' } }],
  outputVariables: [{ value: records }],
  inoutputVariables: [{ value: { modelType: 'Property', idShort: 'Count', valueType: 'xs:int', value: '0' } }],
}
const result = {
  outputArguments: [{ value: { ...records, value: [{ modelType: 'Property', idShort: 'Temperature', valueType: 'xs:double', value: '20.5' }] } }],
  inoutputArguments: [{ value: { modelType: 'Property', idShort: 'Count', valueType: 'xs:int', value: '1' } }],
}

describe('OperationResultStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    infrastructureId.value = 'one'
  })

  it('resolves returned output/inoutput values without replacing the saved nodes', () => {
    const store = useOperationResultStore()
    store.remember('/op', definition, result)
    const node = decorateResolvedOperationNode(records, '/op', ['outputVariables', 0, 'value'])
    expect(store.forNode(node.persistence, node)?.element.value).toEqual(result.outputArguments[0].value.value)
    expect(node.value).toEqual([])
    const count = decorateResolvedOperationNode(definition.inoutputVariables[0].value, '/op', ['inoutputVariables', 0, 'value'])
    expect(store.forNode(count.persistence, count)?.element.value).toBe('1')
    const input = decorateResolvedOperationNode(definition.inputVariables[0].value, '/op', ['inputVariables', 0, 'value'])
    expect(store.forNode(input.persistence, input)).toBeUndefined()
  })

  it('restores the owning operation after navigation but not a modified definition', () => {
    const store = useOperationResultStore()
    store.remember('/op', definition, result)
    expect(store.forOperation('/op', definition)?.result.outputArguments).toEqual(result.outputArguments)
    expect(store.forOperation('/other', definition)).toBeUndefined()
    expect(store.forOperation('/op', { ...definition, idShort: 'Changed' })).toBeUndefined()
    const changed = decorateResolvedOperationNode({ ...records, value: [{ modelType: 'Property', idShort: 'New' }] }, '/op', ['outputVariables', 0, 'value'])
    expect(store.forNode(changed.persistence, changed)).toBeUndefined()
  })

  it('matches returned variables by name instead of response order', () => {
    const store = useOperationResultStore()
    store.remember('/op', definition, { outputArguments: [{ value: { modelType: 'Property', idShort: 'Other', value: 'wrong' } }, ...result.outputArguments] })
    const node = decorateResolvedOperationNode(records, '/op', ['outputVariables', 0, 'value'])
    expect(store.forNode(node.persistence, node)?.element.idShort).toBe('Records')
  })

  it('replaces results with empty outputs and clears results on infrastructure changes or reload', () => {
    const store = useOperationResultStore()
    const node = decorateResolvedOperationNode(records, '/op', ['outputVariables', 0, 'value'])
    store.remember('/op', definition, result)
    store.remember('/op', definition, { outputArguments: [{ value: records }] })
    expect(store.forNode(node.persistence, node)?.element.value).toEqual([])
    store.forget('/op')
    expect(store.forNode(node.persistence, node)).toBeUndefined()
    store.remember('/op', definition, result)
    infrastructureId.value = 'two'
    expect(store.forNode(node.persistence, node)).toBeUndefined()
    store.remember('/op', definition, result)
    setActivePinia(createPinia())
    expect(useOperationResultStore().forNode(node.persistence, node)).toBeUndefined()
  })
})
