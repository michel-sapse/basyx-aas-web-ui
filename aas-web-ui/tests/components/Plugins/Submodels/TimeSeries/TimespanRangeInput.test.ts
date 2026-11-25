import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import { dateTimeTimespan, DEFAULT_TIMESPAN_MAX, DEFAULT_TIMESPAN_MIN, TIMESPAN_SEMANTIC_ID } from '@/components/Plugins/Submodels/TimeSeries/timespan'
import TimespanRangeInput from '@/components/Plugins/Submodels/TimeSeries/TimespanRangeInput.vue'

const range = { modelType: 'Range', idShort: 'Timespan', valueType: 'xs:dateTime', min: DEFAULT_TIMESPAN_MIN, max: DEFAULT_TIMESPAN_MAX, semanticId: { keys: [{ value: TIMESPAN_SEMANTIC_ID }] } }

beforeAll(() => {
  vi.stubGlobal('visualViewport', { addEventListener: vi.fn(), removeEventListener: vi.fn(), width: 1024, height: 768, offsetLeft: 0, offsetTop: 0 })
  vi.stubGlobal('ResizeObserver', class {
    disconnect () {}
    observe () {}
    unobserve () {}
  })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 24))
})

afterEach(() => vi.useRealTimers())

function createWrapper () {
  return mount(TimespanRangeInput, { attachTo: document.body, props: { rangeObject: { ...range } }, global: { plugins: [createVuetify()] } })
}

describe('Timespan operation input', () => {
  it.each([
    ['2026-11-05', '09:15', '2026-11-09', '17:45'],
    ['2026-11-09', '17:45', '2026-11-05', '09:15'],
    ['2026-11-05', '20:30', '2026-11-05', '08:15'],
    ['2026-11-05', '10:00', '2026-11-05', '10:00'],
  ])('selects dates and times as one Range: %s %s then %s %s', async (first, firstTime, second, secondTime) => {
    const wrapper = createWrapper()
    const click = async (date: string) => {
      await wrapper.get(`[data-date="${date}"]`).trigger('click')
      const bounds = wrapper.emitted('update-range')!.at(-1)![0] as { min: string, max: string }
      await wrapper.setProps({ rangeObject: { ...range, ...bounds } })
      return bounds
    }
    const confirm = async (time: string) => {
      wrapper.getComponent({ name: 'TimeWheelPicker' }).vm.$emit('confirm', time)
      await nextTick()
      const bounds = wrapper.emitted('update-range')!.at(-1)![0] as { min: string, max: string }
      await wrapper.setProps({ rangeObject: { ...range, ...bounds } })
      return bounds
    }
    expect(await click(first)).toEqual({ min: '', max: '' })
    expect(wrapper.findComponent({ name: 'TimeWheelPicker' }).exists()).toBe(true)
    expect(await confirm(firstTime)).toEqual({ min: '', max: '' })
    expect(wrapper.text()).toContain('Select the second date and time')
    expect(await click(second)).toEqual({ min: '', max: '' })
    const expected = dateTimeTimespan({ date: first, time: firstTime }, { date: second, time: secondTime })
    expect(await confirm(secondTime)).toEqual(expected)
    expect(wrapper.text()).toContain('From')
    expect(wrapper.text()).toContain('To')
    expect(wrapper.text()).toContain(firstTime)
    expect(wrapper.text()).toContain(secondTime)
    expect(wrapper.findAll('.calendar-endpoint')).toHaveLength(first === second ? 1 : 2)
    if (first !== second) {
      expect(wrapper.findAll('.calendar-between')).toHaveLength(3)
    }
    expect(await click(first)).toEqual({ min: '', max: '' })
    wrapper.getComponent({ name: 'TimeWheelPicker' }).vm.$emit('cancel')
    await nextTick()
    expect(wrapper.emitted('update-range')!.at(-1)![0]).toEqual(expected)
    await wrapper.setProps({ rangeObject: { ...range, ...expected } })
    await wrapper.getComponent({ name: 'DateRangeCalendar' }).vm.$emit('select', '', '')
    await nextTick()
    expect(wrapper.findAll('.calendar-endpoint')).toHaveLength(0)
    wrapper.unmount()
  })

  it('navigates by keyboard across months and years', async () => {
    const wrapper = createWrapper()
    const day = (date: string) => wrapper.get(`[data-date="${date}"]`)
    ;(day('2026-11-05').element as HTMLElement).focus()
    await day('2026-11-05').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(day('2026-11-06').element)
    await day('2026-11-06').trigger('keydown', { key: 'PageDown' })
    expect(document.activeElement).toBe(day('2026-12-01').element)
    await day('2026-12-01').trigger('keydown', { key: 'PageDown' })
    expect(document.activeElement).toBe(day('2027-01-01').element)
    wrapper.unmount()
  })

  it('disables date selection while inputs cannot be edited', async () => {
    const wrapper = createWrapper()
    await wrapper.setProps({ isEditable: false })
    expect(wrapper.get('[data-date="2026-11-05"]').attributes('disabled')).toBeDefined()
    await wrapper.getComponent({ name: 'DateRangeCalendar' }).vm.$emit('date-click', '2026-11-05')
    expect(wrapper.emitted('update-range')).toBeUndefined()
    wrapper.unmount()
  })
})
