import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import TimeWheelPicker from '@/components/Plugins/Submodels/TimeSeries/TimeWheelPicker.vue'

beforeAll(() => {
  vi.stubGlobal('visualViewport', { addEventListener: vi.fn(), removeEventListener: vi.fn(), width: 1024, height: 768, offsetLeft: 0, offsetTop: 0 })
  vi.stubGlobal('ResizeObserver', class {
    disconnect () {}
    observe () {}
    unobserve () {}
  })
})

describe('Time wheel popup', () => {
  it('confirms the full typed time with Return in the minute field', async () => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time: '00:00' }, global: { plugins: [createVuetify()] } })
    await nextTick()
    wrapper.getComponent({ name: 'VDialog' }).vm.$emit('afterEnter')
    const columns = wrapper.findAllComponents({ name: 'TimeWheelColumn' })
    await columns[0]!.get('input').setValue('08')
    const minutes = columns[1]!.get('input')
    await minutes.setValue('30')
    await minutes.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('confirm')).toEqual([['08:30']])
    wrapper.unmount()
  })

  it('confirms with Return in the hour field without overwriting an uncommitted digit', async () => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time: '00:45' }, global: { plugins: [createVuetify()] } })
    await nextTick()
    wrapper.getComponent({ name: 'VDialog' }).vm.$emit('afterEnter')
    const hours = wrapper.findAllComponents({ name: 'TimeWheelColumn' })[0]!.get('input')
    await hours.setValue('7')
    await hours.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('confirm')).toEqual([['07:45']])
    wrapper.unmount()
  })

  it('keeps invalid typed times unconfirmed when Return is pressed', async () => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time: '00:00' }, global: { plugins: [createVuetify()] } })
    await nextTick()
    wrapper.getComponent({ name: 'VDialog' }).vm.$emit('afterEnter')
    const hours = wrapper.findAllComponents({ name: 'TimeWheelColumn' })[0]!.get('input')
    await hours.setValue('24')
    await hours.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('confirm')).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['00:00', '23:59'])('focuses and selects the hour when the dialog opens at %s', async time => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time }, global: { plugins: [createVuetify()] } })
    await nextTick()
    wrapper.getComponent({ name: 'VDialog' }).vm.$emit('afterEnter')
    const input = wrapper.findAllComponents({ name: 'TimeWheelColumn' })[0]!.get('input').element as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(2)
    wrapper.unmount()
  })

  it('moves to selected minutes after two hour digits so the time can be typed without another click', async () => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time: '00:00' }, global: { plugins: [createVuetify()] } })
    await nextTick()
    wrapper.getComponent({ name: 'VDialog' }).vm.$emit('afterEnter')
    const columns = wrapper.findAllComponents({ name: 'TimeWheelColumn' })
    const hourInput = columns[0]!.get('input')
    await hourInput.setValue('0')
    expect(document.activeElement).toBe(hourInput.element)
    await hourInput.setValue('08')
    const minuteInput = columns[1]!.get('input')
    expect(document.activeElement).toBe(minuteInput.element)
    expect((minuteInput.element as HTMLInputElement).selectionStart).toBe(0)
    expect((minuteInput.element as HTMLInputElement).selectionEnd).toBe(2)
    await minuteInput.setValue('30')
    Array.from(document.body.querySelectorAll('button')).find(element => element.textContent?.trim() === 'Use time')!.click()
    expect(wrapper.emitted('confirm')!.at(-1)![0]).toBe('08:30')
    wrapper.unmount()
  })

  it('confirms typed hours and minutes without replacing them with the wheel position', async () => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time: '00:00' }, global: { plugins: [createVuetify()] } })
    await nextTick()
    const columns = wrapper.findAllComponents({ name: 'TimeWheelColumn' })
    const hourInput = columns.find(column => column.props('label') === 'Hour')!.get('input')
    await hourInput.trigger('focus')
    await hourInput.setValue('17')
    await hourInput.trigger('blur')
    const minuteInput = columns.find(column => column.props('label') === 'Minute')!.get('input')
    await minuteInput.trigger('focus')
    await minuteInput.setValue('45')
    Array.from(document.body.querySelectorAll('button')).find(element => element.textContent?.trim() === 'Use time')!.click()
    expect(wrapper.emitted('confirm')!.at(-1)![0]).toBe('17:45')
    wrapper.unmount()
  })

  it('disables confirmation for invalid typed values', async () => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time: '00:00' }, global: { plugins: [createVuetify()] } })
    await nextTick()
    const input = wrapper.findAllComponents({ name: 'TimeWheelColumn' })[0]!.get('input')
    await input.trigger('focus')
    await input.setValue('24')
    const button = Array.from(document.body.querySelectorAll('button')).find(element => element.textContent?.trim() === 'Use time')!
    expect(button.disabled).toBe(true)
    ;(wrapper.vm as any).confirmTime()
    expect(wrapper.emitted('confirm')).toBeUndefined()
    wrapper.unmount()
  })

  it('commits the current wheel position when confirming before the scroll debounce', async () => {
    const wrapper = mount(TimeWheelPicker, { props: { date: '2026-11-24', time: '00:00' }, global: { plugins: [createVuetify()] } })
    await nextTick()
    const minuteWheel = wrapper.findAllComponents({ name: 'TimeWheelColumn' }).find(component => component.props('label') === 'Minute')!
    const list = minuteWheel.get('[role="listbox"]')
    list.element.scrollTop = 7 * 40
    await list.trigger('scroll')
    const button = Array.from(document.body.querySelectorAll('button')).find(element => element.textContent?.trim() === 'Use time')!
    button.click()
    expect(wrapper.emitted('confirm')!.at(-1)![0]).toBe('00:07')
    wrapper.unmount()
  })
})
