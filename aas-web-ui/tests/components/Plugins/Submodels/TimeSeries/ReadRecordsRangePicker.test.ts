import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'
import DateRangeCalendar from '@/components/Plugins/Submodels/TimeSeries/DateRangeCalendar.vue'
import { DEFAULT_END_TIME, DEFAULT_START_TIME, pointToUtc } from '@/components/Plugins/Submodels/TimeSeries/fixedOffsetRange'
import RangeTimeControl from '@/components/Plugins/Submodels/TimeSeries/RangeTimeControl.vue'
import ReadRecordsRangePicker from '@/components/Plugins/Submodels/TimeSeries/ReadRecordsRangePicker.vue'

const start = '2026-11-19T11:00:43.815Z'
const end = '2026-11-25T11:00:43.815Z'
const wrappers: Array<ReturnType<typeof mount>> = []
beforeAll(() => {
  vi.stubGlobal('visualViewport', { addEventListener: vi.fn(), removeEventListener: vi.fn(), width: 1200, height: 1000, offsetLeft: 0, offsetTop: 0 })
  vi.stubGlobal('ResizeObserver', class {
    disconnect () {}
    observe () {}
    unobserve () {}
  })
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-25T11:00:00.000Z'))
})
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) {
    wrapper.unmount()
  }
  document.body.innerHTML = ''
  vi.useRealTimers()
})

function element (selector: string) {
  const el = document.querySelector(selector)
  expect(el, selector).toBeTruthy()
  return new DOMWrapper(el!)
}
function button (label: string) {
  const el = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.trim() === label)
  expect(el, label).toBeTruthy()
  return new DOMWrapper(el!)
}
async function picker (empty = false) {
  const wrapper = mount(ReadRecordsRangePicker, { attachTo: document.body, props: { startValue: empty ? DEFAULT_START_TIME : start, endValue: empty ? DEFAULT_END_TIME : end, initialOffset: 60 }, global: { plugins: [createVuetify()] } })
  wrappers.push(wrapper)
  await vi.waitFor(() => expect(document.querySelector('[aria-label="Start hour"]')).toBeTruthy())
  return wrapper
}
async function commit (wrapper: Awaited<ReturnType<typeof picker>>) {
  await button('Apply range').trigger('click')
  const range = wrapper.emitted('update-range')!.at(-1)![0] as { start: string, end: string }
  await wrapper.setProps({ startValue: range.start, endValue: range.end })
  return range
}

describe('ReadRecords Figma range picker', () => {
  it('renders the reference summary, six calendar rows and continuous week-band classes', async () => {
    const wrapper = await picker()
    expect(wrapper.get('.range-summary-value').text()).toContain('Nov 19, 2026, 12:00:43.815 → Nov 25, 2026, 12:00:43.815')
    expect(wrapper.get('.range-summary-badge').text()).toBe('6 days · Custom range')
    expect(document.querySelectorAll('.calendar-marker')).toHaveLength(2)
    expect(document.querySelectorAll('.calendar-between')).toHaveLength(5)
    expect(document.querySelectorAll('[data-date]')).toHaveLength(42)
    expect(element('[data-date="2026-11-19"]').element.parentElement?.classList.contains('calendar-start')).toBe(true)
    expect(element('[data-date="2026-11-25"]').element.parentElement?.classList.contains('calendar-end')).toBe(true)
    expect(element('[data-date="2026-11-18"]').element.parentElement?.getAttribute('aria-selected')).toBe('false')
    expect(Array.from(document.querySelectorAll('[role="columnheader"]')).map(el => el.textContent)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
  })

  it('discards edits on Cancel and commits on Return while keeping the calendar visible', async () => {
    const wrapper = await picker()
    await element('[aria-label="End milliseconds"]').setValue('900')
    expect(wrapper.get('.range-summary-value').text()).toContain('.815')
    await button('Cancel').trigger('click')
    expect(wrapper.emitted('update-range')).toBeUndefined()
    await nextTick()
    expect((element('[aria-label="End milliseconds"]').element as HTMLInputElement).value).toBe('815')
    await element('[aria-label="End milliseconds"]').setValue('900')
    await element('[aria-label="End AM/PM"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update-range')!.at(-1)![0]).toEqual({ start, end: '2026-11-25T11:00:43.900Z' })
    await nextTick()
    expect(wrapper.find('[role="region"]').exists()).toBe(true)
    expect(wrapper.emitted('editing')!.at(-1)).toEqual([false])
  })

  it.each(['Escape', 'Cancel'])('discards edits on %s without hiding the calendar', async action => {
    const wrapper = await picker()
    await element('[aria-label="End milliseconds"]').setValue('900')
    await (action === 'Escape' ? element('[aria-label="End hour"]').trigger('keydown', { key: 'Escape' }) : button('Cancel').trigger('click'))
    await nextTick()
    expect(wrapper.emitted('update-range')).toBeUndefined()
    expect(wrapper.emitted('editing')!.at(-1)).toEqual([false])
    expect(wrapper.find('[role="grid"]').exists()).toBe(true)
    expect((element('[aria-label="End milliseconds"]').element as HTMLInputElement).value).toBe('815')
  })

  it.each([
    [DEFAULT_START_TIME, DEFAULT_END_TIME],
    ['0001-01-01T00:00:00Z', '9999-12-31T23:59:59Z'],
    ['1901-01-03T00:00:00.000Z', DEFAULT_END_TIME],
    [DEFAULT_START_TIME, '1901-01-03T00:00:00.000Z'],
  ])('immediately shows the current month and year for defaults %s / %s', async (startValue, endValue) => {
    const wrapper = mount(ReadRecordsRangePicker, { attachTo: document.body, props: { startValue, endValue, initialOffset: 60 }, global: { plugins: [createVuetify()] } })
    wrappers.push(wrapper)
    await nextTick()
    expect(wrapper.get('[role="grid"]').attributes('aria-label')).toBe('November 2026')
    expect(wrapper.find('.range-summary-value').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Select a time range')
    expect(wrapper.find('[aria-haspopup="dialog"]').exists()).toBe(false)
    expect(wrapper.findAll('.calendar-marker')).toHaveLength(0)
    expect(button('Apply range').attributes('disabled')).toBeDefined()
  })

  it('uses the current year dynamically and the selected offset across New Year', async () => {
    vi.setSystemTime(new Date('2035-12-31T23:30:00.000Z'))
    const wrapper = await picker(true)
    expect(wrapper.get('[role="grid"]').attributes('aria-label')).toBe('January 2036')
  })

  it('preserves deliberately selected years below 100 instead of adding 1900', async () => {
    const wrapper = mount(DateRangeCalendar, { props: { start: '0001-01-15', stop: '', design: true }, global: { plugins: [createVuetify()] } })
    wrappers.push(wrapper)
    expect(wrapper.find('[data-date="0001-01-15"]').exists()).toBe(true)
    expect(wrapper.get('[role="grid"]').attributes('aria-label')).toBe('January 1')
  })

  it('blocks execution only while there are unapplied edits', async () => {
    const wrapper = await picker()
    expect(wrapper.emitted('editing')!.at(-1)).toEqual([false])
    await element('[aria-label="End milliseconds"]').setValue('900')
    expect(wrapper.emitted('editing')!.at(-1)).toEqual([true])
    const range = await commit(wrapper)
    expect(range.end).toBe('2026-11-25T11:00:43.900Z')
    expect(wrapper.emitted('editing')!.at(-1)).toEqual([false])
    await button('Clear range').trigger('click')
    expect(wrapper.emitted('editing')!.at(-1)).toEqual([true])
    await button('Cancel').trigger('click')
    expect(wrapper.emitted('editing')!.at(-1)).toEqual([false])
  })

  it('clears only the draft and rejects invalid/incomplete inputs', async () => {
    const wrapper = await picker()
    await element('[aria-label="End minute"]').setValue('70')
    expect(button('Apply range').attributes('disabled')).toBeDefined()
    expect(element('[aria-label="End minute"]').attributes('aria-invalid')).toBe('true')
    await button('Clear range').trigger('click')
    expect(document.querySelectorAll('.calendar-marker')).toHaveLength(0)
    expect(button('Apply range').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.range-summary-value').text()).toContain('Nov 19')
    await element('[data-date="2026-11-19"]').trigger('click')
    expect(document.querySelectorAll('.calendar-marker')).toHaveLength(1)
    expect(button('Apply range').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update-range')).toBeUndefined()
  })

  it.each([false, true])('orders full date/time pairs for reversed selection: %s', async reverse => {
    const wrapper = await picker(true)
    const first = reverse ? '2026-11-25' : '2026-11-19'
    const second = reverse ? '2026-11-19' : '2026-11-25'
    await wrapper.getComponent({ name: 'ReadRecordsRangeForm' }).vm.$emit('date', first)
    await nextTick()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Start hour')
    for (const [label, value] of [['Start hour', '12'], ['Start minute', '00'], ['Start second', '43'], ['Start milliseconds', '815'], ['Start AM/PM', 'PM']]) {
      await element('[aria-label="' + label + '"]').setValue(value)
    }
    await wrapper.getComponent({ name: 'ReadRecordsRangeForm' }).vm.$emit('date', second)
    await nextTick()
    const prefix = reverse ? 'Start' : 'End'
    expect(document.activeElement?.getAttribute('aria-label')).toBe(prefix + ' hour')
    for (const [part, value] of [['hour', '12'], ['minute', '00'], ['second', '43'], ['milliseconds', '815'], ['AM/PM', 'PM']]) {
      await element('[aria-label="' + prefix + ' ' + part + '"]').setValue(value)
    }
    expect(await commit(wrapper)).toEqual({ start, end })
  })

  it('supports two times on one day and a third click starts an incomplete new pair', async () => {
    const wrapper = await picker()
    await element('[aria-label="End date"]').setValue('Nov 19, 2026')
    await element('[aria-label="End hour"]').setValue('11')
    await element('[aria-label="End AM/PM"]').setValue('AM')
    expect(document.querySelectorAll('.calendar-marker')).toHaveLength(1)
    expect(await commit(wrapper)).toEqual({ start: '2026-11-19T10:00:43.815Z', end: start })
    await nextTick()
    await element('[data-date="2026-11-20"]').trigger('click')
    expect(button('Apply range').attributes('disabled')).toBeDefined()
    expect(document.querySelectorAll('.calendar-marker')).toHaveLength(1)
  })

  it('preserves UTC instants on offset changes and recalculates calendar presets', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-25T11:00:43.815Z'))
    const wrapper = await picker()
    const form = wrapper.getComponent({ name: 'ReadRecordsRangeForm' })
    form.vm.$emit('offset', 345)
    await nextTick()
    expect((element('[aria-label="Start hour"]').element as HTMLInputElement).value).toBe('04')
    expect(pointToUtc((wrapper.vm as any).draftStart, 345)).toBe(start)
    await commit(wrapper)
    expect(wrapper.get('.range-summary-offset').text()).toBe('UTC+05:45')
    await nextTick()
    await button('Today').trigger('click')
    form.vm.$emit('offset', -210)
    await nextTick()
    const range = await commit(wrapper)
    expect(range.start).toBe('2026-11-25T03:30:00.000Z')
    expect(Math.abs(Date.parse(range.end) - Date.parse('2026-11-25T11:00:43.815Z'))).toBeLessThan(1000)
    expect(wrapper.get('.range-summary-badge').text()).toContain('Today')
  })

  it('preserves elapsed-preset instants when only the display offset changes', async () => {
    const wrapper = await picker()
    await button('Last 24 hours').trigger('click')
    const vm = wrapper.vm as any
    const first = { start: pointToUtc(vm.draftStart, 60), end: pointToUtc(vm.draftEnd, 60) }
    wrapper.getComponent({ name: 'ReadRecordsRangeForm' }).vm.$emit('offset', -210)
    await nextTick()
    expect(await commit(wrapper)).toEqual(first)
    expect(wrapper.get('.range-summary-badge').text()).toContain('Last 24 hours')
  })

  it('allows identical timestamps and announces an invalid manually entered date', async () => {
    const wrapper = await picker()
    await element('[aria-label="End date"]').setValue('Nov 19, 2026')
    expect(await commit(wrapper)).toEqual({ start, end: start })
    expect(wrapper.get('.range-summary-badge').text()).toContain('0 seconds')
    await nextTick()
    await element('[aria-label="Start date"]').setValue('2026-02-30')
    expect(button('Apply range').attributes('disabled')).toBeDefined()
    const input = element('[aria-label="Start date"]')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(document.querySelector('[id="' + input.attributes('aria-describedby') + '"]')?.getAttribute('role')).toBe('alert')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update-range')).toHaveLength(1)
  })

  it('navigates the calendar across month and year boundaries by keyboard', async () => {
    await picker()
    await element('[data-date="2026-11-19"]').trigger('keydown', { key: 'PageDown' })
    expect((document.activeElement as HTMLElement | null)?.dataset.date).toBe('2026-12-01')
    await element('[data-date="2026-12-01"]').trigger('keydown', { key: 'PageDown' })
    expect((document.activeElement as HTMLElement | null)?.dataset.date).toBe('2027-01-01')
  })
})

describe('inline time combobox', () => {
  it('selects typed text, advances after expected digits and lets Return select an open dropdown first', async () => {
    const wrapper = mount(RangeTimeControl, { attachTo: document.body, props: { modelValue: '12', label: 'Start hour', min: 1, max: 12 }, global: { plugins: [createVuetify()] } })
    wrappers.push(wrapper)
    ;(wrapper.vm as any).focus()
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).selectionStart).toBe(0)
    expect((input.element as HTMLInputElement).selectionEnd).toBe(2)
    await input.setValue('09')
    expect(wrapper.emitted('advance')).toHaveLength(1)
    await wrapper.setProps({ modelValue: '09' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('update:model-value')!.at(-1)).toEqual(['09'])
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    await wrapper.setProps({ modelValue: '1' })
    await input.trigger('blur')
    ;(input.element as HTMLInputElement).value = '1'
    await input.trigger('blur')
    expect(wrapper.emitted('update:model-value')!.at(-1)).toEqual(['01'])
  })
})
