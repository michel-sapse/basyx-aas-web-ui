import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TimeWheelColumn from '@/components/Plugins/Submodels/TimeSeries/TimeWheelColumn.vue'

afterEach(() => vi.useRealTimers())

describe('Time wheel', () => {
  it('scrolls to the initial value and exposes its selected option', () => {
    const wrapper = mount(TimeWheelColumn, { props: { modelValue: 12, count: 24, label: 'Hour' } })
    expect(wrapper.get('[role="listbox"]').attributes('aria-label')).toBe('Hour')
    expect(wrapper.get('[role="listbox"]').element.scrollTop).toBe(480)
    expect((wrapper.get('[aria-selected="true"] input').element as HTMLInputElement).value).toBe('12')
    wrapper.unmount()
  })

  it('commits the nearest minute when scrolling settles', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TimeWheelColumn, { props: { modelValue: 15, count: 60, label: 'Minute' } })
    const list = wrapper.get('[role="listbox"]')
    list.element.scrollTop = 29 * 40 + 18
    await list.trigger('scroll')
    await vi.advanceTimersByTimeAsync(120)
    expect(wrapper.emitted('update:model-value')!.at(-1)![0]).toBe(29)
    wrapper.unmount()
  })

  it('supports keyboard selection and clamps at hour limits', async () => {
    const wrapper = mount(TimeWheelColumn, { props: { modelValue: 0, count: 24, label: 'Hour' } })
    const list = wrapper.get('[role="listbox"]')
    await list.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('update:model-value')!.at(-1)![0]).toBe(0)
    await list.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:model-value')!.at(-1)![0]).toBe(23)
    await wrapper.setProps({ modelValue: 23 })
    await list.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('update:model-value')!.at(-1)![0]).toBe(23)
    await list.trigger('keydown', { key: 'PageUp' })
    expect(wrapper.emitted('update:model-value')!.at(-1)![0]).toBe(18)
    wrapper.unmount()
  })

  it('accepts typing and pads a single digit when applied', async () => {
    const wrapper = mount(TimeWheelColumn, { props: { modelValue: 12, count: 24, label: 'Hour' } })
    const input = wrapper.get('input')
    expect(input.attributes('aria-label')).toBe('Type hour')
    await input.trigger('focus')
    await input.setValue('7')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    ;(wrapper.vm as any).commitScroll()
    expect(wrapper.emitted('update:model-value')!.at(-1)![0]).toBe(7)
    await wrapper.setProps({ modelValue: 7 })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('07')
    expect(wrapper.get('[role="listbox"]').element.scrollTop).toBe(280)
    wrapper.unmount()
  })

  it('rejects invalid typing and lets Escape restore the selected value', async () => {
    const wrapper = mount(TimeWheelColumn, { props: { modelValue: 12, count: 24, label: 'Hour' } })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('99')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('validity')!.at(-1)![0]).toBe(false)
    expect((wrapper.vm as any).commitScroll()).toBe(false)
    expect(wrapper.emitted('update:model-value')).toBeUndefined()
    await input.trigger('keydown', { key: 'Escape' })
    expect((input.element as HTMLInputElement).value).toBe('12')
    expect(wrapper.emitted('validity')!.at(-1)![0]).toBe(true)
    wrapper.unmount()
  })
})
