<template>
  <div class="pa-3">
    <div class="text-title-small mb-2">{{ nameToDisplay(element) }}</div>

    <v-data-table
      density="compact"
      :headers="recordTable?.headers ?? headers"
      :item-value="recordTable ? 'record' : 'path'"
      :items="recordTable?.items ?? rows"
      :items-per-page="10"
    >
      <template #item.value="{ item }">
        <span class="text-break">{{ item.value }}</span>
      </template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
  import { useReferableUtils } from '@/composables/AAS/ReferableUtils'
  import { operationRecordTable, operationResultRows } from '@/utils/AAS/OperationResultUtils'

  const props = defineProps<{ element: any }>()
  const { nameToDisplay } = useReferableUtils()
  const headers = [
    { title: 'Element', key: 'path' },
    { title: 'Value', key: 'value' },
    { title: 'Type', key: 'valueType' },
  ]
  const rows = computed(() => operationResultRows(props.element))
  const recordTable = computed(() => operationRecordTable(props.element))
</script>
