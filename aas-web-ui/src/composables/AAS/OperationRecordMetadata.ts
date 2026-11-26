import type { OperationResultElement } from '@/types/OperationResult'
import { useConceptDescriptionHandling } from '@/composables/AAS/ConceptDescriptionHandling'
import { useSMRepositoryClient } from '@/composables/Client/SMRepositoryClient'
import { isResultElement, resultChildren } from '@/types/OperationResult'

const recordSemanticId = 'https://admin-shell.io/idta/TimeSeries/Record/1/1'

export function useOperationRecordMetadata (
  operationPath: () => string | undefined,
  fields: () => OperationResultElement[] | undefined,
) {
  const { fetchSme } = useSMRepositoryClient()
  const { fetchCds, unitSuffix } = useConceptDescriptionHandling()
  const units = ref<Record<string, string>>({})
  const schema = ref<OperationResultElement[]>()
  const notice = ref('')
  let generation = 0

  const fieldSignature = computed(() => JSON.stringify(fields()?.map(field => ({
    idShort: field.idShort, valueType: field.valueType, semanticId: field.semanticId,
  }))))

  // Reload schema for a fresh invocation even when its returned field names match.
  watch(() => [operationPath(), fieldSignature.value, fields()], async () => {
    const current = ++generation
    units.value = {}
    schema.value = undefined
    notice.value = ''
    const path = operationPath()
    const requestedFields = fields()
    if (!path || !requestedFields) {
      return
    }
    const separator = path.indexOf('/submodel-elements/')
    if (separator === -1) {
      return
    }
    notice.value = 'Loading record metadata…'
    try {
      const metadata: unknown = await fetchSme(`${path.slice(0, separator)}/submodel-elements/Metadata`)
      if (current !== generation) {
        return
      }
      const record = isResultElement(metadata)
        ? resultChildren(metadata)?.find(element =>
            element.semanticId?.keys?.some(key => key.value === recordSemanticId) || element.idShort === 'Record',
          )
        : undefined
      const definitions = record ? resultChildren(record) : undefined
      if (!definitions) {
        notice.value = 'Record metadata unavailable; values are shown without inferred units.'
        return
      }
      if (definitions.length === 0 || definitions.some(field => field.modelType !== 'Property' || typeof field.idShort !== 'string' || !field.idShort || typeof field.valueType !== 'string' || !field.valueType)
        || new Set(definitions.map(field => field.idShort)).size !== definitions.length) {
        notice.value = 'Record metadata is not a scalar column schema; using returned fields instead.'
        return
      }
      schema.value = definitions
      let mismatch = false
      const entries = await Promise.all(definitions.map(async definition => {
        const field = requestedFields.find(field => field.idShort === definition.idShort)
        const returnedIds = field?.semanticId?.keys?.map(key => key.value) ?? []
        const definedIds = definition.semanticId?.keys?.map(key => key.value) ?? []
        if (field && (definition.valueType !== field.valueType || (returnedIds.length > 0 && !returnedIds.some(id => definedIds.includes(id))))) {
          mismatch = true
          return [definition.idShort ?? '', '']
        }
        const cds = await fetchCds(definition)
        return [definition.idShort ?? '', unitSuffix({ conceptDescriptions: cds })]
      }))
      if (current !== generation) {
        return
      }
      units.value = Object.fromEntries(entries)
      notice.value = mismatch ? 'Some returned fields do not match Record metadata; their units are not inferred.' : ''
    } catch {
      if (current === generation) {
        notice.value = 'Record metadata unavailable; values are shown without inferred units.'
      }
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    generation++
  })

  return { units, notice, schema }
}
