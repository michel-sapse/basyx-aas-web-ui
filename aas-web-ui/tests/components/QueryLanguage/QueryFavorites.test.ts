import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, disposePinia, getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'
import AdvancedQueryDialog from '@/components/QueryLanguage/AdvancedQueryDialog.vue'
import QueryFavoriteActions from '@/components/QueryLanguage/QueryFavoriteActions.vue'
import QueryFavoritesMenu from '@/components/QueryLanguage/QueryFavoritesMenu.vue'
import { useQueryFavoritesStore } from '@/store/QueryFavoritesStore'
import * as queryLanguageUtils from '@/utils/QueryLanguageUtils'

const dispatchSnackbar = vi.hoisted(() => vi.fn())

vi.mock('@/store/NavigationStore', () => ({
  useNavigationStore: () => ({ dispatchSnackbar }),
}))

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn()
    observe = vi.fn()
    unobserve = vi.fn()
  })
  vi.stubGlobal('visualViewport', {
    addEventListener: vi.fn(),
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    removeEventListener: vi.fn(),
    width: 1024,
  })
})

beforeEach(() => {
  dispatchSnackbar.mockClear()
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  document.body.innerHTML = ''
  disposePinia(getActivePinia()!)
  vi.restoreAllMocks()
})

function button (name: string) {
  const element = [...document.body.querySelectorAll('button')].find(item => item.textContent?.trim() === name)
  expect(element, `Button ${name}`).toBeDefined()
  return new DOMWrapper(element!)
}

const query = { $condition: { $boolean: true } }
function mountOptions () {
  return {
    attachTo: document.body,
    global: { plugins: [createVuetify(), getActivePinia()!] },
  }
}

describe('query favorites controls', () => {
  it('saves the entered name directly and creates copies without opening the name dialog', async () => {
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', query },
    })
    await wrapper.get('input[aria-label="Favorite name"]').setValue(' Motors ')
    expect(wrapper.emitted('update:name')?.at(-1)).toEqual([' Motors '])
    await wrapper.setProps({ name: ' Motors ' })
    await button('Save as favorite').trigger('click')
    await flushPromises()

    const store = useQueryFavoritesStore()
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].name).toBe('Motors')
    expect(dispatchSnackbar).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Query favorite "Motors" saved.' }))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    const originalId = store.favorites[0].id
    const copiedQuery = { $condition: { $boolean: false } }
    await wrapper.setProps({ favoriteId: originalId, name: 'Motor copy', query: copiedQuery })
    await button('Save as new favorite').trigger('click')
    await flushPromises()
    expect(store.favorites).toHaveLength(2)
    expect(store.favorites.find(item => item.id === originalId)).toMatchObject({ name: 'Motors', query })
    expect(store.favorites.find(item => item.id !== originalId)).toMatchObject({ name: 'Motor copy', query: copiedQuery })
    expect(JSON.parse(localStorage.getItem('basyxQueryFavorites')!).favorites).toEqual(store.favorites)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it.each(['Update favorite', 'Save as new favorite'])('shows progress only on %s and prevents duplicate saves', async action => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Motors', 'aas-repository', query)
    let completeSave!: (id: string) => void
    const pending = new Promise<string>(resolve => {
      completeSave = resolve
    })
    const save = vi.spyOn(store, 'save').mockReturnValue(pending)
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', query, favoriteId: id, name: 'Motors' },
    })
    const buttons = wrapper.findAllComponents({ name: 'VBtn' })
    const clicked = buttons.find(item => item.props('text') === action)!
    const other = buttons.find(item => item.props('text') !== action)!
    await clicked.trigger('click')
    expect(clicked.props('loading')).toBe(true)
    expect(other.props('loading')).toBe(false)
    expect(other.props('disabled')).toBe(true)
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    expect(save).toHaveBeenCalledTimes(1)
    completeSave(id)
    await flushPromises()
    expect(clicked.props('loading')).toBe(false)
    expect(other.props('disabled')).toBe(false)
    wrapper.unmount()
  })

  it('saves on Enter and updates the current favorite on Enter', async () => {
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', query, name: 'Motors' },
    })
    expect(wrapper.findComponent({ name: 'VTextField' }).props('autofocus')).toBe(true)
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const store = useQueryFavoritesStore()
    const id = store.favorites[0].id
    await wrapper.setProps({ favoriteId: id, name: 'Renamed motors' })
    await wrapper.get('input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(store.favorites).toEqual([{ id, name: 'Renamed motors', target: 'aas-repository', query }])
    wrapper.unmount()
  })

  it('saves from the editor and explicitly updates the selected favorite', async () => {
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', query },
    })
    expect(button('Save as favorite').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ name: ' ' })
    expect(button('Save as favorite').attributes('disabled')).toBeDefined()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    await wrapper.setProps({ name: 'Motors' })
    await button('Save as favorite').trigger('click')
    await flushPromises()

    const store = useQueryFavoritesStore()
    const id = store.favorites[0].id
    expect(store.favorites[0]).toEqual({ id, name: 'Motors', target: 'aas-repository', query })
    expect(wrapper.emitted('saved')).toEqual([[id, 'Motors']])
    await wrapper.setProps({ favoriteId: id, name: 'Renamed motors', query: { $condition: { $boolean: false } } })
    expect(store.favorites[0].query).toEqual(query)
    await button('Update favorite').trigger('click')
    await flushPromises()
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].name).toBe('Renamed motors')
    expect(store.favorites[0].query.$condition).toEqual({ $boolean: false })
    wrapper.unmount()
  })

  it('shows persistence failures inline without opening a naming popup', async () => {
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-registry', query },
    })
    await wrapper.setProps({ name: 'Registry' })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage denied', 'SecurityError')
    })
    await button('Save as favorite').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('could not be saved')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(useQueryFavoritesStore().favorites).toEqual([])
    await wrapper.setProps({ name: 'Corrected registry' })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables saving while the editor query is invalid', () => {
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', name: 'Motors' },
    })
    expect(button('Save as favorite').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('runs compatible favorites and offers editing and deletion for unavailable favorites', async () => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Motors', 'aas-repository', query)
    const wrapper = mount(QueryFavoritesMenu, {
      ...mountOptions(),
      props: { availableTargets: ['aas-repository'], infrastructureTemplate: 'full' },
    })
    await wrapper.get('[aria-label="Run Motors"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[store.favorites[0]]])
    await wrapper.setProps({ availableTargets: [] })
    expect(wrapper.text()).toContain('AAS Repository querying is unavailable')
    expect(wrapper.find('[aria-label="Run Motors"]').exists()).toBe(false)
    await wrapper.get('[aria-label^="Motors, unavailable:"]').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.get('[aria-label="Edit Motors"]').trigger('click')
    expect(wrapper.emitted('edit')).toEqual([[store.favorites[0]]])
    expect(store.favorites[0].name).toBe('Motors')
    expect(wrapper.emitted('select')).toHaveLength(1)

    await wrapper.get('[aria-label="Delete Motors"]').trigger('click')
    await flushPromises()
    await button('Cancel').trigger('click')
    await flushPromises()
    expect(store.favorites[0].id).toBe(id)
    await wrapper.get('[aria-label="Delete Motors"]').trigger('click')
    await flushPromises()
    await button('Delete').trigger('click')
    await flushPromises()
    expect(store.favorites).toEqual([])
    expect(wrapper.text()).toContain('No saved query favorites')
    wrapper.unmount()
  })

  it('explains when a saved hierarchy query needs a mono-all infrastructure', async () => {
    const store = useQueryFavoritesStore()
    await store.save('Nameplates', 'aas-repository', {
      $condition: { $contains: [{ $field: '$sm#idShort' }, { $strVal: 'Nameplate' }] },
    })
    const wrapper = mount(QueryFavoritesMenu, {
      ...mountOptions(),
      props: { availableTargets: ['aas-repository'], infrastructureTemplate: 'full' },
    })
    expect(wrapper.text()).toContain('only available with mono-all infrastructures')
    expect(wrapper.find('[aria-label="Run Nameplates"]').exists()).toBe(false)
    await wrapper.get('[aria-label^="Nameplates, unavailable:"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })

  it('edits the name and query together in the advanced dialog and saves them to the same favorite', async () => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Motors', 'aas-repository', query)
    const wrapper = mount(AdvancedQueryDialog, {
      ...mountOptions(),
      props: {
        modelValue: true,
        endpoint: 'https://repo.example',
        favoriteId: id,
        favoriteName: 'Motors',
        favoritesEnabled: true,
        infrastructureTemplate: 'full',
        loading: false,
        mobile: false,
        query: JSON.stringify(query),
        target: 'aas-repository',
        title: 'Advanced AAS query',
      },
      global: { ...mountOptions().global, stubs: { QueryLanguageEditor: true } },
    })
    await flushPromises()
    const input = new DOMWrapper(document.body.querySelector('input')!)
    expect((input.element as HTMLInputElement).value).toBe('Motors')
    await input.setValue('Renamed motors')
    expect(wrapper.emitted('update:favoriteName')?.at(-1)).toEqual(['Renamed motors'])
    await wrapper.setProps({ favoriteName: 'Renamed motors', query: JSON.stringify({ $condition: { $boolean: false } }) })
    wrapper.findComponent({ name: 'QueryLanguageEditor' }).vm.$emit('validation-change', { isValid: true, messages: [] })
    await flushPromises()
    await button('Update favorite').trigger('click')
    await flushPromises()

    expect(store.favorites).toEqual([{ id, name: 'Renamed motors', target: 'aas-repository', query: { $condition: { $boolean: false } } }])
    expect(JSON.parse(localStorage.getItem('basyxQueryFavorites')!).favorites).toEqual(store.favorites)
    expect(wrapper.emitted('execute')).toBeUndefined()
    await input.setValue('')
    await wrapper.setProps({ favoriteName: '' })
    expect(button('Update favorite').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('allows saving an existing favorite when its query target is unavailable', async () => {
    const store = useQueryFavoritesStore()
    const availableQuery = query
    const id = await store.save('Nameplates', 'aas-repository', availableQuery)
    const wrapper = mount(AdvancedQueryDialog, {
      ...mountOptions(),
      props: {
        modelValue: true,
        endpoint: '',
        executionEnabled: false,
        favoriteId: id,
        favoriteName: 'Renamed nameplates',
        favoritesEnabled: true,
        infrastructureTemplate: 'full',
        loading: false,
        mobile: false,
        query: JSON.stringify(availableQuery),
        target: 'aas-repository',
        title: 'Advanced AAS query',
      },
      global: { ...mountOptions().global, stubs: { QueryLanguageEditor: true } },
    })
    await flushPromises()
    wrapper.findComponent({ name: 'QueryLanguageEditor' }).vm.$emit('validation-change', { isValid: true, messages: [] })
    await flushPromises()
    expect(button('Run query').attributes('disabled')).toBeDefined()
    expect(document.body.textContent).toContain('Querying is unavailable')
    await button('Update favorite').trigger('click')
    await flushPromises()
    expect(store.favorites[0].name).toBe('Renamed nameplates')
    expect(store.favorites[0].query).toEqual(availableQuery)
    wrapper.unmount()
  })

  it('keeps the entered name when the favorite is deleted in another tab', async () => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Motors', 'aas-repository', query)
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', query, favoriteId: id, name: 'Draft motors' },
    })
    store.remove(id)
    await flushPromises()
    expect(wrapper.get('input').element.value).toBe('Draft motors')
    expect(wrapper.text()).not.toContain('Update favorite')
    expect(button('Save as favorite').attributes('disabled')).toBeUndefined()
    await button('Save as favorite').trigger('click')
    await flushPromises()
    expect(store.favorites[0].name).toBe('Draft motors')
    wrapper.unmount()
  })

  it('blocks saving and updating a favorite incompatible with the active infrastructure', async () => {
    const store = useQueryFavoritesStore()
    const hierarchyQuery = { $condition: { $contains: [{ $field: '$sm#idShort' }, { $strVal: 'Nameplate' }] } }
    const id = await store.save('Nameplates', 'aas-repository', hierarchyQuery)
    const wrapper = mount(AdvancedQueryDialog, {
      ...mountOptions(),
      props: {
        modelValue: true,
        endpoint: 'https://repo.example',
        favoriteId: id,
        favoriteName: 'Nameplates',
        favoritesEnabled: true,
        infrastructureTemplate: 'full',
        loading: false,
        mobile: false,
        query: JSON.stringify(hierarchyQuery),
        target: 'aas-repository',
        title: 'Advanced AAS query',
      },
      global: { ...mountOptions().global, stubs: { QueryLanguageEditor: true } },
    })
    await flushPromises()
    wrapper.findComponent({ name: 'QueryLanguageEditor' }).vm.$emit('validation-change', { isValid: true, messages: [] })
    await flushPromises()
    expect(button('Run query').attributes('disabled')).toBeDefined()
    expect(button('Update favorite').attributes('disabled')).toBeDefined()
    expect(button('Save as new favorite').attributes('disabled')).toBeDefined()
    const alert = document.querySelector('[role="alert"]')!
    const editor = document.querySelector('query-language-editor-stub')!
    expect(alert).not.toBeNull()
    expect(alert.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await wrapper.setProps({ infrastructureTemplate: 'mono-all' })
    expect(button('Update favorite').attributes('disabled')).toBeUndefined()
    expect(button('Save as new favorite').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps a failed save local to the editor and clears it on the next editor session', async () => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Motors', 'aas-repository', query)
    const actions = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', query, favoriteId: id, active: true },
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage denied', 'SecurityError')
    })
    await button('Update favorite').trigger('click')
    await flushPromises()
    expect(actions.text()).toContain('could not be saved')
    const menu = mount(QueryFavoritesMenu, {
      ...mountOptions(),
      props: { availableTargets: ['aas-repository'], infrastructureTemplate: 'full' },
    })
    expect(menu.text()).not.toContain('could not be saved')
    await menu.get('[aria-label="Delete Motors"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('.v-overlay--active [role="alert"]')).toBeNull()
    await button('Cancel').trigger('click')
    await actions.setProps({ active: false })
    await actions.setProps({ active: true })
    expect(actions.text()).not.toContain('could not be saved')
    menu.unmount()
    actions.unmount()
  })

  it('shows deletion errors in the delete dialog and clears them when it is reopened', async () => {
    const store = useQueryFavoritesStore()
    await store.save('Motors', 'aas-repository', query)
    const wrapper = mount(QueryFavoritesMenu, {
      ...mountOptions(),
      props: { availableTargets: ['aas-repository'], infrastructureTemplate: 'full' },
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage denied', 'SecurityError')
    })
    await wrapper.get('[aria-label="Delete Motors"]').trigger('click')
    await flushPromises()
    await button('Delete').trigger('click')
    await flushPromises()
    expect(document.querySelector('.v-overlay--active [role="alert"]')?.textContent).toContain('could not be saved')
    expect(store.favorites).toHaveLength(1)
    expect(wrapper.text()).not.toContain('could not be saved')
    await button('Cancel').trigger('click')
    await wrapper.get('[aria-label="Delete Motors"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('.v-overlay--active [role="alert"]')).toBeNull()
    wrapper.unmount()
  })

  it('keeps the delete selection on a true model update and closes it on false', async () => {
    await useQueryFavoritesStore().save('Motors', 'aas-repository', query)
    const wrapper = mount(QueryFavoritesMenu, {
      ...mountOptions(),
      props: { availableTargets: ['aas-repository'], infrastructureTemplate: 'full' },
    })
    await wrapper.get('[aria-label="Delete Motors"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'VDialog' })
    dialog.vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(dialog.props('modelValue')).toBe(true)
    dialog.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(dialog.props('modelValue')).toBe(false)
    wrapper.unmount()
  })

  it('reuses validation for availability changes and refreshes it for query and template changes', async () => {
    const store = useQueryFavoritesStore()
    await store.save('Motors', 'aas-repository', query)
    const validate = vi.spyOn(queryLanguageUtils, 'validateQueryForTarget')
    const wrapper = mount(QueryFavoritesMenu, {
      ...mountOptions(),
      props: { availableTargets: ['aas-repository'], infrastructureTemplate: 'full' },
    })
    expect(validate).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ availableTargets: [] })
    await wrapper.setProps({ availableTargets: ['aas-repository'] })
    expect(validate).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ infrastructureTemplate: 'mono-all' })
    expect(validate).toHaveBeenCalledTimes(2)
    store.favorites[0].query = { $condition: { $eq: [{ $field: '$aasdesc#id' }, { $strVal: 'Motor' }] } }
    await flushPromises()
    expect(validate).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('not valid for this query target')
    wrapper.unmount()
  })

  it('shows both favorite states with an editable name field and no dropdown', async () => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Motors', 'aas-repository', query)
    const wrapper = mount(QueryFavoriteActions, {
      ...mountOptions(),
      props: { target: 'aas-repository', query },
    })
    expect(wrapper.text()).toContain('Saved query')
    expect(wrapper.text()).not.toContain('Update favorite')
    expect(wrapper.get('input').attributes('placeholder')).toBe('Enter a favorite name…')
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    await wrapper.get('input').setValue('New motors')
    expect(wrapper.emitted('update:name')?.at(-1)).toEqual(['New motors'])
    await wrapper.setProps({ favoriteId: id, name: 'Motors' })
    expect(wrapper.text()).toContain('Update favorite')
    expect(wrapper.text()).toContain('Save as new favorite')
    expect(wrapper.get('input').element.value).toBe('Motors')
    expect(wrapper.find('[role="combobox"]').exists()).toBe(false)
    expect(wrapper.find('.mdi-star-outline').exists()).toBe(true)
    wrapper.unmount()
  })
})
