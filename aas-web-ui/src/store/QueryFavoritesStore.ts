import type { QueryFavorite, QueryFavoritesStorage, QueryLanguageQuery } from '@/types/QueryLanguage'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { validateQueryLanguageSchema } from '@/pages/modules/queryLanguage/queryLanguageSchemaValidation'
import { validateQueryForTarget } from '@/utils/QueryLanguageUtils'
import { getLocalStorageItem, setLocalStorageItem } from '@/utils/storage'

const STORAGE_KEY = 'basyxQueryFavorites'

class DeletedQueryFavoriteError extends Error {}

export const useQueryFavoritesStore = defineStore('queryFavoritesStore', () => {
  const favorites = ref<QueryFavorite[]>([])
  const loadError = ref('')

  function load (): void {
    try {
      favorites.value = readFavorites()
      loadError.value = ''
    } catch {
      loadError.value = 'Saved query favorites could not be loaded. Check browser storage access and the saved data format.'
    }
  }

  async function save (
    name: string,
    target: QueryFavorite['target'],
    query: QueryLanguageQuery,
    id?: string,
  ): Promise<string> {
    const queryText = JSON.stringify(query)
    const validation = await validateQueryLanguageSchema(queryText)
    const context = validateQueryForTarget(queryText, target, 'mono-all')
    if (!name.trim() || !validation.isValid || !context.isValid || !context.query) {
      throw new Error(validation.message || context.message || 'Enter a name for the favorite.')
    }

    const favorite: QueryFavorite = { id: id ?? uuidv4(), name: name.trim(), target, query: context.query }
    persist(current => {
      if (!id) {
        return [...current, favorite]
      }
      if (!current.some(item => item.id === id)) {
        throw new DeletedQueryFavoriteError('This query favorite has been deleted. Save it as a new favorite.')
      }
      return current.map(item => item.id === id ? favorite : item)
    })
    return favorite.id
  }

  function remove (id: string): void {
    persist(current => current.filter(item => item.id !== id))
  }

  function persist (update: (current: QueryFavorite[]) => QueryFavorite[]): void {
    try {
      const next = update(readFavorites())
      const storage: QueryFavoritesStorage = { version: 1, favorites: next }
      setLocalStorageItem(STORAGE_KEY, JSON.stringify(storage))
      favorites.value = next
      loadError.value = ''
    } catch (error_) {
      if (error_ instanceof DeletedQueryFavoriteError) {
        throw error_
      }
      throw new Error('Query favorites could not be saved. Check browser storage access, available space and the saved data format.', { cause: error_ })
    }
  }

  function handleStorageChange (event: StorageEvent): void {
    if (event.storageArea === window.localStorage && (event.key === STORAGE_KEY || event.key === null)) {
      load()
    }
  }

  load()
  window.addEventListener('storage', handleStorageChange)
  onScopeDispose(() => window.removeEventListener('storage', handleStorageChange))

  return { favorites, loadError, save, remove }
})

function readFavorites (): QueryFavorite[] {
  const text = getLocalStorageItem(STORAGE_KEY)
  if (!text) {
    return []
  }
  const storage: unknown = JSON.parse(text)
  if (!storage || typeof storage !== 'object' || !('version' in storage) || storage.version !== 1
    || !('favorites' in storage) || !Array.isArray(storage.favorites)) {
    throw new Error('Unsupported query favorites storage format.')
  }

  const seen = new Set<string>()
  return storage.favorites.filter((item): item is QueryFavorite => {
    if (!isQueryFavorite(item) || seen.has(item.id)) {
      return false
    }
    seen.add(item.id)
    return true
  })
}

function isQueryFavorite (value: unknown): value is QueryFavorite {
  if (!value || typeof value !== 'object') {
    return false
  }
  const item = value as Partial<QueryFavorite>
  return typeof item.id === 'string' && item.id.trim() !== ''
    && typeof item.name === 'string' && item.name.trim() !== ''
    && (item.target === 'aas-registry' || item.target === 'aas-repository')
    && !!item.query && typeof item.query === 'object' && !Array.isArray(item.query)
    && !!item.query.$condition && typeof item.query.$condition === 'object' && !Array.isArray(item.query.$condition)
}
