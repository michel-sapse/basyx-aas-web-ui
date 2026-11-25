import type { QueryLanguageQuery } from '@/types/QueryLanguage'
import { createPinia, disposePinia, getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQueryFavoritesStore } from '@/store/QueryFavoritesStore'

const storageKey = 'basyxQueryFavorites'
const query: QueryLanguageQuery = { $condition: { $boolean: true } }

describe('query favorites persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    disposePinia(getActivePinia()!)
    vi.restoreAllMocks()
  })

  it('saves multiple favorites and restores the versioned collection after a reload', async () => {
    const store = useQueryFavoritesStore()
    const first = await store.save(' Motors ', 'aas-repository', query)
    const second = await store.save('Registry', 'aas-registry', query)

    expect(first).not.toBe(second)
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({
      version: 1,
      favorites: [
        { id: first, name: 'Motors', target: 'aas-repository', query },
        { id: second, name: 'Registry', target: 'aas-registry', query },
      ],
    })
    disposePinia(getActivePinia()!)
    setActivePinia(createPinia())
    expect(useQueryFavoritesStore().favorites).toEqual(store.favorites)
  })

  it('takes a snapshot and only changes the saved query through an explicit update', async () => {
    const store = useQueryFavoritesStore()
    const draft = structuredClone(query)
    const saving = store.save('Original', 'aas-repository', draft)
    draft.$condition = { $boolean: false }
    const id = await saving

    expect(store.favorites[0].query).toEqual(query)
    await store.save('Original', 'aas-repository', draft, id)
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].query).toEqual(draft)
  })

  it('renames and deletes individual favorites while preserving the others', async () => {
    const store = useQueryFavoritesStore()
    const first = await store.save('First', 'aas-repository', query)
    const second = await store.save('Second', 'aas-registry', query)

    expect(await store.save(' Renamed ', 'aas-repository', query, first)).toBe(first)
    expect(store.favorites[0].name).toBe('Renamed')
    store.remove(first!)
    expect(store.favorites.map(item => item.id)).toEqual([second])
    expect(JSON.parse(localStorage.getItem(storageKey)!).favorites).toEqual(store.favorites)
  })

  it('validates query syntax, target and name before saving', async () => {
    const store = useQueryFavoritesStore()
    await expect(store.save(' ', 'aas-repository', query)).rejects.toThrow('Enter a name')
    await expect(store.save('Invalid', 'aas-repository', { $condition: { $unsupported: [] } })).rejects.toThrow('schema')
    await expect(store.save('Wrong target', 'aas-registry', {
      $condition: { $eq: [{ $field: '$aas#idShort' }, { $strVal: 'Motor' }] },
    })).rejects.toThrow('not valid for this query target')
    expect(localStorage.getItem(storageKey)).toBeNull()
    expect(store.favorites).toEqual([])
  })

  it.each(['{invalid', JSON.stringify({ version: 2, favorites: [] })])('reports unreadable storage and preserves its contents', async stored => {
    localStorage.setItem(storageKey, stored)
    const store = useQueryFavoritesStore()

    expect(store.favorites).toEqual([])
    expect(store.loadError).toContain('could not be loaded')
    await expect(store.save('New', 'aas-repository', query)).rejects.toThrow('could not be saved')
    expect(localStorage.getItem(storageKey)).toBe(stored)
  })

  it('loads valid favorites alongside malformed entries and duplicate IDs', () => {
    const favorite = { id: 'one', name: 'Valid', target: 'aas-registry', query }
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      favorites: [null, {}, favorite, { ...favorite, name: 'Duplicate' }],
    }))
    expect(useQueryFavoritesStore().favorites).toEqual([favorite])
  })

  it('leaves saved and in-memory data intact when writes fail', async () => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Original', 'aas-repository', query)
    const stored = localStorage.getItem(storageKey)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    await expect(store.save('Additional', 'aas-registry', query)).rejects.toThrow('could not be saved')
    await expect(store.save('Renamed', 'aas-repository', query, id)).rejects.toThrow('could not be saved')
    expect(() => store.remove(id!)).toThrow('could not be saved')
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].name).toBe('Original')
    expect(localStorage.getItem(storageKey)).toBe(stored)
    expect(store.loadError).toBe('')
  })

  it('reports inaccessible browser storage without crashing the store', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage denied', 'SecurityError')
    })
    const store = useQueryFavoritesStore()
    expect(store.loadError).toContain('could not be loaded')
    await expect(store.save('New', 'aas-registry', query)).rejects.toThrow('could not be saved')
  })

  it('refreshes other-tab changes and reads the latest collection before saving', async () => {
    const store = useQueryFavoritesStore()
    const other = { id: 'other', name: 'Other tab', target: 'aas-registry', query }
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, favorites: [other] }))
    await store.save('This tab', 'aas-repository', query)
    expect(store.favorites[0]).toEqual(other)

    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))
    expect(store.favorites).toEqual([])
    expect(store.loadError).toBe('')
  })

  it('does not recreate a favorite deleted in another tab during an update', async () => {
    const store = useQueryFavoritesStore()
    const id = await store.save('Original', 'aas-repository', query)
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, favorites: [] }))

    await expect(store.save('Updated', 'aas-repository', query, id)).rejects.toThrow('has been deleted')
    expect(JSON.parse(localStorage.getItem(storageKey)!).favorites).toEqual([])
  })
})
