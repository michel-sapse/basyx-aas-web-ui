<template>
  <v-menu v-model="open" :close-on-content-click="false" location="bottom end" max-width="400">
    <template #activator="{ props: activator }">
      <v-btn v-bind="activator" color="primary" prepend-icon="mdi-download" variant="flat">Export CSV</v-btn>
    </template>

    <v-card min-width="300" title="Export CSV">
      <template #append>
        <v-btn
          aria-label="Close export"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="open = false"
        />
      </template>

      <v-card-text>
        <v-text-field v-model="filename" label="File name" />

        <v-radio-group v-model="scope" label="Records to export">
          <v-radio :label="`All records (${allRows.length})`" value="all" />
          <v-radio :label="`Filtered records (${filteredRows.length})`" value="filtered" />
          <v-radio :label="`Current page (${pageRows.length})`" value="page" />
        </v-radio-group>

        <v-select
          v-model="columnScope"
          :items="[{ title: `Visible columns (${visibleColumns.length})`, value: 'visible' }, { title: `All columns (${columns.length})`, value: 'all' }]"
          label="Columns to export"
        />

        <v-checkbox v-model="includeHeaders" hide-details label="Include column headers" />
        <p class="text-body-small mt-3" role="status">{{ selectedRows.length }} records · {{ selectedColumns.length }} columns · UTF-8 · Comma-separated</p>
      </v-card-text>

      <v-card-actions>
        <v-btn @click="open = false">Cancel</v-btn>
        <v-spacer />

        <v-btn
          color="primary"
          :disabled="!filename.trim() || selectedColumns.length === 0"
          prepend-icon="mdi-download"
          variant="flat"
          @click="download"
        >Export {{ selectedRows.length }} records</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
  import type { RecordColumn, RecordRow } from '@/utils/AAS/RecordTableUtils'
  import { recordsCsv } from '@/utils/AAS/RecordTableUtils'

  const props = defineProps<{ allRows: RecordRow[], filteredRows: RecordRow[], pageRows: RecordRow[], columns: RecordColumn[], visibleColumns: RecordColumn[] }>()
  const open = ref(false)
  const filename = ref('records.csv')
  const scope = ref('all')
  const columnScope = ref('visible')
  const includeHeaders = ref(true)
  const selectedRows = computed(() => scope.value === 'page' ? props.pageRows : (scope.value === 'filtered' ? props.filteredRows : props.allRows))
  const selectedColumns = computed(() => columnScope.value === 'visible' ? props.visibleColumns : props.columns)

  function download (): void {
    const blob = new Blob([recordsCsv(selectedRows.value, selectedColumns.value, includeHeaders.value)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const name = filename.value.trim().replaceAll(/[\\/]/g, '_')
    link.href = url
    link.download = name.toLowerCase().endsWith('.csv') ? name : `${name}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    open.value = false
  }
</script>
