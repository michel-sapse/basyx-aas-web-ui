import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseSpatialLayout } from '@/components/Plugins/Submodels/SpatialLayout/parse'
import SpatialLayoutViewer from '@/components/Plugins/Submodels/SpatialLayout/SpatialLayoutViewer.vue'
import { demo } from './fixtures'

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), dispose: vi.fn(), setView: vi.fn(), fitLayout: vi.fn(), focusSelected: vi.fn() }))
vi.mock('@/components/Plugins/Submodels/SpatialLayout/scene', () => ({ createSpatialScene: mocks.create }))
const slot = { template: '<div><slot /></div>' }
function render () {
  const layout = parseSpatialLayout(demo())
  return mount(SpatialLayoutViewer, { props: { layout, drafts: {}, selectedId: layout.assets[0]!.id, editable: true }, global: { stubs: { VSheet: slot, VBtnToggle: slot, VBtn: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }, VAlert: slot } } })
}
describe('viewer lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockReturnValue(mocks)
  })
  it('updates without recreating the scene and disposes on unmount', async () => {
    const wrapper = render()
    await flushPromises()
    expect(mocks.create).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ drafts: { 'urn:basyx:demo:aas:Server01': { x: 0, y: 0, z: 20 } } })
    expect(mocks.update).toHaveBeenCalledTimes(2)
    await wrapper.findAll('button').find(button => button.text() === 'Front')!.trigger('click')
    expect(mocks.setView).toHaveBeenCalledWith('front')
    wrapper.unmount()
    expect(mocks.dispose).toHaveBeenCalledTimes(1)
  })
  it('communicates WebGL failure while keeping numeric editing available', async () => {
    mocks.create.mockImplementation(() => {
      throw new Error('WebGL unavailable')
    })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('WebGL unavailable')
    expect(wrapper.text()).toContain('Numeric coordinates remain available')
    wrapper.unmount()
  })
})
