<template>
  <v-dialog v-model="dialogOpen" max-width="420" persistent>
    <v-card :title="title">
      <v-form @submit.prevent="submit">
        <v-card-text>
          <v-text-field
            v-model="name"
            autofocus
            :disabled="loading"
            label="Favorite name"
            variant="outlined"
          />

          <v-alert
            v-if="error"
            density="compact"
            role="alert"
            type="error"
            variant="tonal"
          >
            {{ error }}
          </v-alert>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="loading" text="Cancel" @click="dialogOpen = false" />

          <v-btn
            color="primary"
            :disabled="!name.trim() || loading"
            :loading="loading"
            text="Save"
            type="submit"
            variant="flat"
          />
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
  const props = withDefaults(defineProps<{
    title: string
    initialName?: string
    error?: string
    loading?: boolean
  }>(), { initialName: '', error: '', loading: false })

  const emit = defineEmits<{ save: [name: string] }>()
  const dialogOpen = defineModel<boolean>({ required: true })
  const name = ref('')

  watch(dialogOpen, open => {
    if (open) name.value = props.initialName
  }, { immediate: true })

  function submit (): void {
    if (name.value.trim() && !props.loading) emit('save', name.value.trim())
  }
</script>
