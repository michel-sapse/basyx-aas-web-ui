export const SPATIAL_LAYOUT_SEMANTIC_ID = 'urn:apeirora.eu:idcm:cd:assetPositionalData:Submodel'
export const AXES = ['x', 'y', 'z'] as const
export type Axis = typeof AXES[number]
export type Position = Record<Axis, number>
export type PositionText = Record<Axis, string>
export type SignedAxis = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z'
export type AasElement = Record<string, any>
export type Unit = { name: string, factor: number, physicalUnit: string }
export type CoordinateFrame = {
  name: string
  units: Record<Axis, Unit>
  upDirection: SignedAxis
  forwardDirection: SignedAxis
  angleUnit: Unit
  rotationOrder: string
  offset: Position
}
export type Placement = {
  id: string
  name: string
  aasId: string
  position: Position
  rotation: { yaw: number, pitch: number, roll: number }
  // Explicit demo extensions, not inferred asset geometry or alignment.
  dimensions: Position | null
  reference: Position | null
  positionElement: AasElement
  positionPath: string
}
export type SpatialLayout = {
  id: string
  path: string
  frame: CoordinateFrame
  area: { name: string, type: string, polygon: Position[] } | null
  assets: Placement[]
  warnings: string[]
}
export type PositionDrafts = Record<string, Position>
