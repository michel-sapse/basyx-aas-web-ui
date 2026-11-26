import { jsonization } from '@aas-core-works/aas-core3.1-typescript'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpatialPositionEditor from '@/components/Plugins/Submodels/SpatialLayout/SpatialPositionEditor.vue'
import SpatialLayout from '@/components/Plugins/Submodels/SpatialLayout_v1_0.vue'
import { child, coordinates, demo, path } from './fixtures'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), put: vi.fn(), env: { getAllowEditing: true } }))
vi.mock('@/composables/Client/SMRepositoryClient', () => ({ useSMRepositoryClient: () => ({ fetchSm: mocks.fetch, putSubmodelElement: mocks.put }) }))
vi.mock('@/store/EnvironmentStore', () => ({ useEnvStore: () => mocks.env }))
const slot = { template: '<div><slot /></div>' }
const stubs = {
  VContainer: slot, VCard: slot, VCardTitle: slot, VCardText: slot, VChip: slot, VAlert: slot,
  VIcon: true, VSpacer: true, VTooltip: true, VProgressLinear: true,
  VBtn: { props: ['disabled', 'loading'], template: '<button :disabled="disabled || loading"><slot /></button>' },
  VTextField: { props: ['modelValue', 'readonly', 'errorMessages'], emits: ['update:modelValue'], template: '<div><input :value="modelValue" :readonly="readonly" @input="$emit(\'update:modelValue\', $event.target.value)"><span>{{ errorMessages.join() }}</span></div>' },
  VSelect: { props: ['modelValue', 'items'], emits: ['update:modelValue'], template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>' },
  SpatialLayoutViewer: { props: ['layout', 'drafts', 'selectedId', 'editable'], emits: ['select', 'move'], template: '<div data-test="scene" />' },
}
function mountPlugin () {
  return mount(SpatialLayout, { props: { submodelElementData: { ...demo(), path } }, global: { stubs } })
}
function button (wrapper: ReturnType<typeof mountPlugin>, text: string) {
  return wrapper.findAll('button').find(element => element.text() === text)!
}

describe('spatial draft editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.env.getAllowEditing = true
    mocks.fetch.mockImplementation(async () => demo())
    mocks.put.mockResolvedValue(true)
  })
  it('keeps numeric and target changes as drafts, and Cancel restores saved placement', async () => {
    const wrapper = mountPlugin()
    await flushPromises()
    expect(wrapper.text()).toContain('Rack Unit')
    const inputs = wrapper.findAll('input')
    await inputs[2]!.setValue('20')
    expect(wrapper.text()).toContain('Unsaved preview')
    expect(mocks.put).not.toHaveBeenCalled()
    await button(wrapper, 'Cancel').trigger('click')
    expect(inputs[2]!.element.value).toBe('22')
    await button(wrapper, 'Preview target position').trigger('click')
    expect(inputs[2]!.element.value).toBe('20')
    expect(mocks.put).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('saves a typed AAS collection through the actual client adapter and reloads confirmed data', async () => {
    const data = demo()
    mocks.fetch.mockImplementation(async () => structuredClone(data))
    mocks.put.mockImplementation(async (typed, endpoint) => {
      expect(endpoint).toContain('Positions[0].CartesianCoordinates')
      coordinates(data).value = jsonization.toJsonable(typed).value
      return true
    })
    const wrapper = mountPlugin()
    await flushPromises()
    await wrapper.findAll('input')[2]!.setValue('20')
    await button(wrapper, 'Save coordinates').trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledTimes(1)
    expect(mocks.fetch).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('Showing stored coordinates')
    expect(child(coordinates(data), 'Xvalue').value).toBe('0.0')
    wrapper.unmount()
  })
  it('retains an invalid input, keeps the last valid preview and disables Save', async () => {
    const wrapper = mountPlugin()
    await flushPromises()
    await wrapper.findAll('input')[2]!.setValue('20')
    await wrapper.findAll('input')[2]!.setValue('')
    expect(wrapper.text()).toContain('Enter a finite number')
    expect(wrapper.findComponent(stubs.SpatialLayoutViewer).props('drafts')['urn:basyx:demo:aas:Server01'].z).toBe(20)
    expect(button(wrapper, 'Save coordinates').attributes('disabled')).toBeDefined()
    expect(mocks.put).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('retains drafts across selection and camera events, including axis drag values', async () => {
    const wrapper = mountPlugin()
    await flushPromises()
    const viewer = wrapper.findComponent(stubs.SpatialLayoutViewer)
    viewer.vm.$emit('move', 'urn:basyx:demo:aas:Server01', { x: 0, y: 0, z: 20 })
    await flushPromises()
    await wrapper.find('select').setValue('urn:basyx:demo:aas:Server02')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('28')
    await wrapper.find('select').setValue('urn:basyx:demo:aas:Server01')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('20')
    expect(mocks.put).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('retains drafts on failed Save and exposes backend errors', async () => {
    mocks.put.mockResolvedValue(false)
    const wrapper = mountPlugin()
    await flushPromises()
    await wrapper.findAll('input')[2]!.setValue('20')
    await button(wrapper, 'Save coordinates').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('draft has been retained')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('20')
    expect(button(wrapper, 'Save coordinates').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('respects the editing feature flag', async () => {
    mocks.env.getAllowEditing = false
    const wrapper = mountPlugin()
    await flushPromises()
    expect(wrapper.findAll('input')[2]!.attributes('readonly')).toBeDefined()
    expect(button(wrapper, 'Save coordinates').attributes('disabled')).toBeDefined()
    await wrapper.findComponent(SpatialPositionEditor).vm.$emit('save')
    expect(mocks.put).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('keeps another draft’s original baseline when saving the selected asset', async () => {
    const data = demo()
    mocks.fetch.mockImplementation(async () => structuredClone(data))
    mocks.put.mockImplementation(async typed => {
      coordinates(data).value = jsonization.toJsonable(typed).value
      // Another user changes Server02 during the Server01 save.
      child(coordinates(data, 1), 'Zvalue').value = '30'
      return true
    })
    const wrapper = mountPlugin()
    await flushPromises()
    await wrapper.find('select').setValue('urn:basyx:demo:aas:Server02')
    await wrapper.findAll('input')[2]!.setValue('26')
    await wrapper.find('select').setValue('urn:basyx:demo:aas:Server01')
    await wrapper.findAll('input')[2]!.setValue('20')
    await button(wrapper, 'Save coordinates').trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledTimes(1)
    await wrapper.find('select').setValue('urn:basyx:demo:aas:Server02')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('26')
    await button(wrapper, 'Save coordinates').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Placement data changed')
    expect(mocks.put).toHaveBeenCalledTimes(1)
    await button(wrapper, 'Cancel').trigger('click')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('30')
    wrapper.unmount()
  })
  it('shows malformed data rather than fabricated coordinates', async () => {
    mocks.fetch.mockResolvedValue({})
    const wrapper = mountPlugin()
    await flushPromises()
    expect(wrapper.text()).toContain('Asset Positional Data submodel is required')
    expect(wrapper.findAll('input')).toHaveLength(0)
    wrapper.unmount()
  })
})
