<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-2 mb-4">
      <div :aria-label="`${title} (${rows.length})`" class="text-title-small">
        {{ title }} <v-chip class="ml-2" color="primary" size="x-small">{{ rows.length }}</v-chip>
      </div>

      <v-spacer />

      <v-text-field
        v-model="search"
        aria-label="Search records"
        clearable
        density="compact"
        hide-details
        label="Search records"
        max-width="280"
        min-width="180"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
      />

      <RecordFilterMenu :columns="columns" :filters="filters" @apply="filters = $event" />

      <v-menu :close-on-content-click="false" location="bottom end" max-width="320">
        <template #activator="{ props: activator }">
          <v-btn v-bind="activator" prepend-icon="mdi-view-column-outline" variant="outlined">Columns</v-btn>
        </template>

        <template #default="{ isActive }">
          <v-card min-width="280" title="Visible columns">
            <template #append>
              <v-btn
                aria-label="Close columns"
                icon="mdi-close"
                size="small"
                variant="text"
                @click="isActive.value = false"
              />
            </template>

            <v-card-text>
              <p class="text-body-small mb-2">{{ visibleColumns.length }} of {{ columns.length }} visible</p>

              <v-checkbox
                v-for="column in columns"
                :key="column.key"
                v-model="selectedKeys"
                density="compact"
                :disabled="selectedKeys.length === 1 && selectedKeys.includes(column.key)"
                hide-details
                :label="column.title"
                :value="column.key"
              />
            </v-card-text>

            <v-card-actions>
              <v-btn @click="selectedKeys = columns.map(column => column.key)">Reset to default</v-btn>
              <v-spacer />
              <v-btn color="primary" variant="flat" @click="isActive.value = false">Done</v-btn>
            </v-card-actions>
          </v-card>
        </template>
      </v-menu>

      <RecordExportMenu
        :all-rows="sortedAll"
        :columns="columns"
        :filtered-rows="sortedRows"
        :page-rows="pageRows"
        :visible-columns="visibleColumns"
      />
    </div>

    <p v-if="search || filters.length > 0" class="text-body-small mb-3" role="status">
      {{ sortedRows.length }} of {{ rows.length }} records match. Search includes hidden columns.
      <v-btn size="small" variant="text" @click="clearSearchAndFilters">Clear search and filters</v-btn>
    </p>

    <v-data-table-server
      v-model:sort-by="sortBy"
      class="records-table"
      density="comfortable"
      :headers="headers"
      hide-default-footer
      :items="pageRows"
      :items-length="sortedRows.length"
      :items-per-page="pageSize"
      :page="page"
    >
      <template v-for="column in visibleColumns" :key="column.key" #[`header.${column.key}`]="{ column: tableColumn, isSorted, getSortIcon }">
        <div>
          <div class="d-flex align-center ga-1" :class="recordColumnKind(column) === 'number' ? 'justify-end' : ''">
            {{ column.title }}
            <v-icon :color="isSorted(tableColumn) ? 'primary' : undefined" :icon="isSorted(tableColumn) ? getSortIcon(tableColumn) : 'mdi-unfold-more-horizontal'" size="x-small" />
          </div>

          <div v-if="column.unit" class="text-caption text-medium-emphasis">{{ column.unit }}</div>
        </div>
      </template>

      <template v-for="column in visibleColumns" :key="column.key" #[`item.${column.key}`]="{ item }">
        <span v-if="item[column.key] === '(no value)'" aria-label="No value" class="text-medium-emphasis">—</span>
        <span v-else>{{ item[column.key] }}</span>
      </template>

      <template #no-data>
        {{ rows.length > 0 ? 'No records match the search and filters.' : 'No records returned.' }}
      </template>
    </v-data-table-server>

    <div class="bg-surface-light pa-2 text-caption text-medium-emphasis d-flex flex-wrap ga-3">
      <span>Field types:</span>
      <span v-for="group in fieldTypes" :key="group.type">{{ group.names.join(', ') }}: {{ group.type }}</span>
      <span>Timestamp values retain their original timezone.</span>
    </div>

    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mt-3">
      <span class="text-body-small" role="status">{{ startRow }}–{{ endRow }} of {{ sortedRows.length }} records</span>

      <v-select
        v-model="pageSize"
        density="compact"
        hide-details
        :items="[10, 25, 50, 100]"
        label="Rows per page"
        max-width="150"
        variant="outlined"
      />

      <v-pagination
        v-model="page"
        color="primary"
        :length="pageCount"
        show-first-last-page
        size="small"
        :total-visible="5"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { RecordColumn, RecordFilter, RecordRow, RecordSort } from '@/utils/AAS/RecordTableUtils'
  import { filterRecordRows, recordColumnKind, sortRecordRows } from '@/utils/AAS/RecordTableUtils'

  const props = defineProps<{ title: string, columns: RecordColumn[], rows: RecordRow[] }>()
  const search = ref<string | null>('')
  const filters = ref<RecordFilter[]>([])
  const selectedKeys = ref(props.columns.map(column => column.key))
  const sortBy = ref<RecordSort[]>(defaultSort())
  const page = ref(1)
  const pageSize = ref(10)
  const visibleColumns = computed(() => props.columns.filter(column => selectedKeys.value.includes(column.key)))
  const headers = computed(() => visibleColumns.value.map(column => ({
    title: column.title, key: column.key, align: recordColumnKind(column) === 'number' ? 'end' as const : 'start' as const,
    headerProps: { 'aria-label': `${column.title}${column.unit ? ` [${column.unit}]` : ''}` },
  })))
  const filteredRows = computed(() => filterRecordRows(props.rows, props.columns, search.value ?? '', filters.value))
  const sortedRows = computed(() => sortRecordRows(filteredRows.value, props.columns, sortBy.value))
  const sortedAll = computed(() => sortRecordRows(props.rows, props.columns, sortBy.value))
  const pageCount = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / pageSize.value)))
  const pageRows = computed(() => sortedRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
  const startRow = computed(() => sortedRows.value.length > 0 ? (page.value - 1) * pageSize.value + 1 : 0)
  const endRow = computed(() => Math.min(page.value * pageSize.value, sortedRows.value.length))
  const schema = computed(() => JSON.stringify(props.columns.map(column => [column.key, column.valueType])))
  const fieldTypes = computed(() => {
    const groups = new Map<string, string[]>()
    for (const column of visibleColumns.value) {
      if (!column.valueType) continue
      const names = groups.get(column.valueType) ?? []
      names.push(column.title)
      groups.set(column.valueType, names)
    }
    return [...groups].map(([type, names]) => ({ type, names }))
  })

  watch([search, filters, pageSize, sortBy, () => props.rows], () => {
    page.value = 1
  }, { deep: true })
  watch(schema, () => {
    selectedKeys.value = props.columns.map(column => column.key)
    filters.value = []
    sortBy.value = defaultSort()
    page.value = 1
  })

  function clearSearchAndFilters (): void {
    search.value = ''
    filters.value = []
  }

  function defaultSort (): RecordSort[] {
    const time = props.columns.find(column => recordColumnKind(column) === 'time')
    return time ? [{ key: time.key, order: 'asc' }] : []
  }
</script>

<style scoped>
  .records-table :deep(th) {
    background: rgb(var(--v-theme-surface-light));
    white-space: nowrap;
  }

  .records-table :deep(td) {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
