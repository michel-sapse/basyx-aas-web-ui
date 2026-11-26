import { parseSpatialLayout, samePosition } from './parse'
import { type AasElement, AXES, type Placement, type Position, type SpatialLayout } from './types'

type PlacementIO = { read: () => Promise<AasElement>, write: (element: AasElement, path: string) => Promise<boolean> }
function context (layout: SpatialLayout, asset: Placement): string {
  return JSON.stringify({ frame: layout.frame, area: layout.area, aasId: asset.aasId, rotation: asset.rotation, reference: asset.reference, dimensions: asset.dimensions })
}
export async function savePlacement (layout: SpatialLayout, id: string, position: Position, io: PlacementIO): Promise<SpatialLayout> {
  if (AXES.some(axis => !Number.isFinite(position[axis]))) {
    throw new Error('Enter three finite coordinates before saving.')
  }
  const original = layout.assets.find(asset => asset.id === id)
  if (!original?.positionPath) {
    throw new Error('This placement has no repository endpoint.')
  }
  const fresh = parseSpatialLayout(await io.read(), layout.path)
  const current = fresh.assets.find(asset => asset.id === id)
  if (!current || !samePosition(current.position, original.position) || context(layout, original) !== context(fresh, current)) {
    throw new Error('Placement data changed in the repository. Refresh and review your draft before saving.')
  }
  // Use fresh metadata and update only coordinate values that actually changed.
  const element = structuredClone(current.positionElement)
  for (const axis of AXES) {
    if (Math.abs(position[axis] - current.position[axis]) > 1e-8) {
      element.value.find((property: AasElement) => property.idShort === axis.toUpperCase() + 'value').value = String(position[axis])
    }
  }
  if (!await io.write(element, current.positionPath)) {
    throw new Error('Saving failed. Your draft has been retained.')
  }
  const confirmed = parseSpatialLayout(await io.read(), layout.path)
  const saved = confirmed.assets.find(asset => asset.id === id)
  if (!saved || !samePosition(saved.position, position) || context(confirmed, saved) !== context(fresh, current)) {
    throw new Error('The repository did not confirm the saved coordinates and frame. Refresh before retrying; your draft has been retained.')
  }
  return confirmed
}
