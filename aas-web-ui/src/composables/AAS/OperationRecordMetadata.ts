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
  const notice = ref('')
  let generation = 0

  const fieldSignature = computed(() => JSON.stringify(fields()?.map(field => ({
    idShort: field.idShort, valueType: field.valueType, semanticId: field.semanticId,
  }))))

  watch(() => [operationPath(), fieldSignature.value], async () => {
    const current = ++generation
    units.value = {}
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
      let mismatch = false
      const entries = await Promise.all(requestedFields.map(async field => {
        const matches = definitions.filter(candidate => candidate.idShort === field.idShort)
        const definition = matches.length === 1 ? matches[0] : undefined
        const returnedIds = field.semanticId?.keys?.map(key => key.value) ?? []
        const definedIds = definition?.semanticId?.keys?.map(key => key.value) ?? []
        if (!definition || definition.valueType !== field.valueType || (returnedIds.length > 0 && !returnedIds.some(id => definedIds.includes(id)))) {
          mismatch = true
          return [field.idShort ?? '', '']
        }
        const cds = await fetchCds(definition)
        return [field.idShort ?? '', unitSuffix({ conceptDescriptions: cds })]
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

  return { units, notice }
}
