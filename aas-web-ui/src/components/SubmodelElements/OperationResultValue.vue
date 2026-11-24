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
  import { useConceptDescriptionHandling } from '@/composables/AAS/ConceptDescriptionHandling'
  import { useReferableUtils } from '@/composables/AAS/ReferableUtils'
  import { useSMRepositoryClient } from '@/composables/Client/SMRepositoryClient'
  import { operationRecordTable, operationResultRows } from '@/utils/AAS/OperationResultUtils'

  const props = defineProps<{ element: any, operationPath?: string }>()
  const { nameToDisplay } = useReferableUtils()
  const { fetchSme } = useSMRepositoryClient()
  const { fetchCds, unitSuffix } = useConceptDescriptionHandling()
  const units = ref<Record<string, string>>({})
  const metadataNotice = ref('')
  let generation = 0
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
  const recordHeaders = computed(() => recordTable.value?.headers.map((header, index) => {
    if (index === 0) return header
    const field = props.element.value[0].value[index - 1]
    const unit = units.value[field.idShort]
    return { ...header, title: unit ? `${field.idShort} [${unit}] (${field.valueType})` : header.title }
  }))

  watch(() => [props.operationPath, recordTable.value ? JSON.stringify(props.element.value[0].value.map((field: any) => ({ idShort: field.idShort, valueType: field.valueType, semanticId: field.semanticId }))) : ''], async () => {
    const current = ++generation
    units.value = {}
    metadataNotice.value = ''
    if (!recordTable.value || !props.operationPath || props.element.idShort !== 'Records') return
    const separator = props.operationPath.indexOf('/submodel-elements/')
    if (separator === -1) return
    metadataNotice.value = 'Loading record metadata…'
    try {
      const metadata = await fetchSme(`${props.operationPath.slice(0, separator)}/submodel-elements/Metadata`)
      if (current !== generation) return
      const record = metadata?.value?.find((element: any) => element.semanticId?.keys?.some((key: any) => key.value === 'https://admin-shell.io/idta/TimeSeries/Record/1/1') || element.idShort === 'Record')
      if (!Array.isArray(record?.value)) {
        metadataNotice.value = 'Record metadata unavailable; values are shown without inferred units.'
        return
      }
      const fields = props.element.value[0].value
      let mismatch = false
      const entries = await Promise.all(fields.map(async (field: any) => {
        const matches = record.value.filter((candidate: any) => candidate.idShort === field.idShort)
        const definition = matches.length === 1 ? matches[0] : undefined
        const returnedIds = field.semanticId?.keys?.map((key: any) => key.value) ?? []
        const definedIds = definition?.semanticId?.keys?.map((key: any) => key.value) ?? []
        if (!definition || definition.valueType !== field.valueType || (returnedIds.length > 0 && !returnedIds.some((id: string) => definedIds.includes(id)))) {
          mismatch = true
          return [field.idShort, '']
        }
        const cds = await fetchCds(definition)
        return [field.idShort, unitSuffix({ conceptDescriptions: cds })]
      }))
      if (current !== generation) return
      units.value = Object.fromEntries(entries)
      metadataNotice.value = mismatch ? 'Some returned fields do not match Record metadata; their units are not inferred.' : ''
    } catch {
      if (current === generation) {
        metadataNotice.value = 'Record metadata unavailable; values are shown without inferred units.'
      }
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    generation++
  })
</script>
