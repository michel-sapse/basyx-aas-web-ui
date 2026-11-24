<template>
  <div class="pa-3">
    <div class="text-title-small mb-2">{{ resultTitle }}</div>

    <div v-if="metadataNotice" class="text-caption mb-2" role="status">{{ metadataNotice }}</div>

    <v-data-table
      density="compact"
      :headers="recordHeaders ?? headers"
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
  import type { OperationResultElement } from '@/types/OperationResult'
  import { useOperationRecordMetadata } from '@/composables/AAS/OperationRecordMetadata'
  import { useReferableUtils } from '@/composables/AAS/ReferableUtils'
  import { operationRecordTable, operationResultRows } from '@/utils/AAS/OperationResultUtils'

  const props = defineProps<{ element: OperationResultElement, operationPath?: string }>()
  const { nameToDisplay } = useReferableUtils()
  const headers = [
    { title: 'Element', key: 'path' },
    { title: 'Value', key: 'value' },
    { title: 'Type', key: 'valueType' },
  ]
  const rows = computed(() => operationResultRows(props.element))
  const resultTitle = computed(() => {
    const name = nameToDisplay(props.element)
    if (props.element.idShort === 'Records' && Array.isArray(props.element.value)) {
      return `${name} (${props.element.value.length})`
    }
    return name
  })
  const recordTable = computed(() => operationRecordTable(props.element))
  const { units, notice: metadataNotice } = useOperationRecordMetadata(
    () => props.operationPath,
    () => props.element.idShort === 'Records' ? recordTable.value?.fields : undefined,
  )
  const recordHeaders = computed(() => recordTable.value?.headers.map((header, index) => {
    if (index === 0) return header
    const field = recordTable.value!.fields[index - 1]
    const unit = units.value[field.idShort ?? '']
    const name = nameToDisplay(field)
    return { ...header, title: `${name}${unit ? ` [${unit}]` : ''} (${field.valueType})` }
  }))
</script>
