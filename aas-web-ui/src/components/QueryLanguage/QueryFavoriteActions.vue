<template>
  <div class="d-flex align-center flex-wrap ga-2">
    <v-btn
      :disabled="!query || saving"
      prepend-icon="mdi-star-plus-outline"
      text="Save as favorite"
      variant="text"
      @click="openSaveDialog"
    />

    <v-btn
      v-if="favorite"
      :disabled="!query || !favoriteName.trim() || saving"
      :loading="saving"
      prepend-icon="mdi-star-outline"
      text="Update favorite"
      variant="text"
      @click="save(favoriteName, favorite.id)"
    />

    <v-alert
      v-if="error && !nameDialog"
      density="compact"
      role="alert"
      type="error"
      variant="tonal"
    >
      {{ error }}
    </v-alert>
  </div>

  <QueryFavoriteNameDialog
    v-model="nameDialog"
    :error="error"
    :initial-name="favoriteName"
    :loading="saving"
    title="Save query as favorite"
    @save="save($event)"
  />
</template>

<script setup lang="ts">
  import type { QueryFavorite, QueryLanguageQuery } from '@/types/QueryLanguage'
  import { useNavigationStore } from '@/store/NavigationStore'
  import { useQueryFavoritesStore } from '@/store/QueryFavoritesStore'

  const props = defineProps<{
    query?: QueryLanguageQuery
    target: QueryFavorite['target']
    favoriteId?: string
    name?: string
    active?: boolean
  }>()
  const emit = defineEmits<{ saved: [id: string, name: string] }>()

  const favoritesStore = useQueryFavoritesStore()
  const navigationStore = useNavigationStore()
  const nameDialog = ref(false)
  const saving = ref(false)
  const error = ref('')

  const favorite = computed(() => favoritesStore.favorites.find(item =>
    item.id === props.favoriteId && item.target === props.target,
  ))
  const favoriteName = computed(() => favorite.value ? props.name ?? favorite.value.name : '')

  watch([() => props.active, () => props.favoriteId], () => {
    error.value = ''
  })

  function openSaveDialog (): void {
    error.value = ''
    nameDialog.value = true
  }

  async function save (name: string, id?: string): Promise<void> {
    if (!props.query || saving.value) return
    error.value = ''
    saving.value = true
    try {
      const savedId = await favoritesStore.save(name, props.target, props.query, id)
      nameDialog.value = false
      emit('saved', savedId, name.trim())
      navigationStore.dispatchSnackbar({ status: true, color: 'success', text: `Query favorite "${name}" saved.` })
    } catch (error_) {
      error.value = error_ instanceof Error ? error_.message : 'The query favorite could not be saved.'
    } finally {
      saving.value = false
    }
  }
</script>
