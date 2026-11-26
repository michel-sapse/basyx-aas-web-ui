import type { AasElement } from '@/components/Plugins/Submodels/SpatialLayout/types'
import generated from '../../../../../../examples/SpatialLayout/environment.json'
import original from '../../../../../../examples/SpatialLayout/PositionalData.json'

export const path = 'http://localhost:19081/submodels/dXJuOmJhc3l4OmRlbW86cG9zaXRpb25hbC1kYXRh'
export function sample (): AasElement {
  return structuredClone(original)
}
export function demo (): AasElement {
  return structuredClone(generated.submodels[0])
}
export function child (element: AasElement, name: string): AasElement {
  return (element.submodelElements || element.value).find((item: AasElement) => item.idShort === name)
}
export function entry (submodel: AasElement, index = 0): AasElement {
  return child(submodel, 'Positions').value[index]
}
export function coordinates (submodel: AasElement, index = 0): AasElement {
  return child(entry(submodel, index), 'CartesianCoordinates')
}
