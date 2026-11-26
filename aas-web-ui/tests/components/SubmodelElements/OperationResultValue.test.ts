import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OperationResultValue from '@/components/SubmodelElements/OperationResultValue.vue'

const mocks = vi.hoisted(() => ({ fetchSme: vi.fn(), fetchCds: vi.fn() }))
vi.mock('@/composables/Client/SMRepositoryClient', () => ({ useSMRepositoryClient: () => ({ fetchSme: mocks.fetchSme }) }))
vi.mock('@/composables/AAS/ReferableUtils', () => ({ useReferableUtils: () => ({ nameToDisplay: (element: any) => element.idShort }) }))
vi.mock('@/composables/AAS/ConceptDescriptionHandling', () => ({
  useConceptDescriptionHandling: () => ({ fetchCds: mocks.fetchCds, unitSuffix: (element: any) => element.conceptDescriptions[0]?.unit ?? '' }),
}))

const temperature = { modelType: 'Property', idShort: 'Temperature', valueType: 'xs:integer', value: '20' }
const records = { modelType: 'SubmodelElementCollection', idShort: 'Records', value: [
  { modelType: 'SubmodelElementCollection', idShort: 'Record1', value: [temperature] },
  { modelType: 'SubmodelElementCollection', idShort: 'Record2', value: [{ ...temperature, value: '21' }] },
] }
function render () {
  return mount(OperationResultValue, {
    props: { element: records, operationPath: 'http://localhost:8081/submodels/id/submodel-elements/ReadRecords' },
    global: { stubs: {
      'v-data-table': { props: ['headers', 'items'], template: '<div>{{ headers }} {{ items }}</div>' },
      'OperationRecordsTable': { name: 'OperationRecordsTable', props: ['title', 'rows', 'columns'], template: '<div><div class="text-title-small">{{ title }} ({{ rows.length }})</div>{{ columns }} {{ rows }}</div>' },
    } },
  })
}
describe('OperationResultValue metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchSme.mockResolvedValue({ value: [{ idShort: 'Record', value: [temperature] }] })
    mocks.fetchCds.mockResolvedValue([{ unit: '°C' }])
  })
  it('shows the total record count and updates it for subsequent and empty results', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('.text-title-small').text()).toBe('Records (2)')
    await wrapper.setProps({ element: { ...records, value: Array.from({ length: 25 }, (_, index) => ({ ...records.value[0], idShort: `Record${index + 1}` })) } })
    expect(wrapper.get('.text-title-small').text()).toBe('Records (25)')
    await wrapper.setProps({ element: { ...records, value: [] } })
    expect(wrapper.get('.text-title-small').text()).toBe('Records (0)')
    wrapper.unmount()
  })
  it('resolves units once per column without changing the returned values', async () => {
    const before = structuredClone(records)
    const wrapper = render()
    await flushPromises()
    expect(mocks.fetchSme).toHaveBeenCalledWith('http://localhost:8081/submodels/id/submodel-elements/Metadata')
    expect(mocks.fetchCds).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('°C')
    expect(wrapper.text()).toContain('xs:integer')
    expect(records).toEqual(before)
    wrapper.unmount()
  })
  it('shows every metadata column in schema order even when the response omits a metric', async () => {
    const schema = [{ ...temperature, idShort: 'Humidity', value: '999' }, { ...temperature, value: undefined }]
    mocks.fetchSme.mockResolvedValue({ value: [{ idShort: 'Record', value: schema }] })
    const wrapper = render()
    await flushPromises()
    const table = wrapper.getComponent({ name: 'OperationRecordsTable' })
    expect(table.props('columns').map((column: { title: string }) => column.title)).toEqual(['Record', 'Humidity', 'Temperature'])
    expect(table.props('rows')[0]).toEqual({ record: 'Record1', field0: '(no value)', field1: '20' })
    expect(mocks.fetchCds).toHaveBeenCalledTimes(2)
    expect(schema[0].value).toBe('999')
    wrapper.unmount()
  })
  it('does not infer units when the returned type disagrees with metadata', async () => {
    mocks.fetchSme.mockResolvedValue({ value: [{ idShort: 'Record', value: [{ ...temperature, valueType: 'xs:double' }] }] })
    const wrapper = render()
    await flushPromises()
    expect(mocks.fetchCds).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('do not match')
    expect(wrapper.text()).not.toContain('°C')
    wrapper.unmount()
  })
  it('keeps values visible if metadata is missing', async () => {
    mocks.fetchSme.mockResolvedValue({})
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('metadata unavailable')
    expect(wrapper.text()).toContain('21')
    wrapper.unmount()
  })
  it('ignores a late metadata response after changing operations', async () => {
    let resolveFirst!: (value: any) => void
    mocks.fetchSme.mockImplementationOnce(() => new Promise(resolve => {
      resolveFirst = resolve
    }))
    mocks.fetchSme.mockResolvedValueOnce({})
    const wrapper = render()
    await wrapper.setProps({ operationPath: 'http://localhost:8081/submodels/other/submodel-elements/ReadRecords' })
    await flushPromises()
    resolveFirst({ value: [{ idShort: 'Record', value: [temperature] }] })
    await flushPromises()
    expect(wrapper.text()).toContain('metadata unavailable')
    expect(mocks.fetchCds).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
