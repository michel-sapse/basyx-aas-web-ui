<template>
  <v-menu v-model="open" :close-on-content-click="false" location="bottom end" max-width="480">
    <template #activator="{ props: activator }">
      <v-btn v-bind="activator" :color="filters.length > 0 ? 'primary' : undefined" prepend-icon="mdi-filter-variant" variant="outlined">
        Filter{{ filters.length > 0 ? ` (${filters.length})` : '' }}
      </v-btn>
    </template>

    <v-card min-width="300" title="Filter records">
      <template #append>
        <v-btn
          aria-label="Close filters"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="open = false"
        />
      </template>

      <v-card-text>
        <p class="text-body-small mb-4">All conditions must match. Apply to update the table.</p>

        <div v-for="(filter, index) in draft" :key="index" class="mb-4">
          <v-select
            v-model="filter.key"
            item-title="title"
            item-value="key"
            :items="columns"
            :label="`Column ${index + 1}`"
            @update:model-value="filter.operator = 'eq'"
          />

          <v-row dense>
            <v-col cols="6">
              <v-select v-model="filter.operator" :items="operators(filter.key)" :label="`Operator ${index + 1}`" />
            </v-col>

            <v-col cols="6">
              <v-text-field
                v-model="filter.value"
                :error-messages="filter.value ? recordFilterError(filter, columns) : []"
                :label="`Value ${index + 1}`"
                :suffix="columns.find(column => column.key === filter.key)?.unit"
              />
            </v-col>
          </v-row>

          <v-btn
            :aria-label="`Remove condition ${index + 1}`"
            prepend-icon="mdi-delete-outline"
            size="small"
            variant="text"
            @click="draft.splice(index, 1)"
          >Remove</v-btn>
        </div>

        <v-btn
          color="primary"
          :disabled="columns.length === 0"
          prepend-icon="mdi-plus"
          variant="text"
          @click="addCondition"
        >Add condition</v-btn>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn @click="clearFilters">Clear filters</v-btn>
        <v-spacer />
        <v-btn color="primary" :disabled="draft.some(filter => !!recordFilterError(filter, columns))" variant="flat" @click="apply">Apply filters</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
  import type { RecordColumn, RecordFilter } from '@/utils/AAS/RecordTableUtils'
  import { recordColumnKind, recordFilterError } from '@/utils/AAS/RecordTableUtils'

  const props = defineProps<{ columns: RecordColumn[], filters: RecordFilter[] }>()
  const emit = defineEmits<{ apply: [filters: RecordFilter[]] }>()
  const open = ref(false)
  const draft = ref<RecordFilter[]>([])

  watch(open, value => {
    if (value) draft.value = props.filters.map(filter => ({ ...filter }))
  })

  function operators (key: string) {
    const column = props.columns.find(column => column.key === key)
    const equality = [{ title: 'is equal to', value: 'eq' }, { title: 'is not equal to', value: 'ne' }]
    if (!column || recordColumnKind(column) === 'text') return [{ title: 'contains', value: 'contains' }, ...equality]
    return [
      ...equality,
      { title: 'is greater than', value: 'gt' }, { title: 'is greater than or equal to', value: 'gte' },
      { title: 'is less than', value: 'lt' }, { title: 'is less than or equal to', value: 'lte' },
    ]
  }

  function addCondition (): void {
    draft.value.push({ key: props.columns[0]?.key ?? '', operator: 'eq', value: '' })
  }

  function clearFilters (): void {
    draft.value = []
    emit('apply', [])
    open.value = false
  }

  function apply (): void {
    emit('apply', draft.value.map(filter => ({ ...filter })))
    open.value = false
  }
</script>
