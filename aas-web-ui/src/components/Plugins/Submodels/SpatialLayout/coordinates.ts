import type { CoordinateFrame, Placement, Position, PositionDrafts, SignedAxis, SpatialLayout } from './types'
import { Matrix4, Vector3 } from 'three'

export function axisVector (direction: SignedAxis): Vector3 {
  const vector = new Vector3()
  vector.setComponent('XYZ'.indexOf(direction[1]!), direction[0] === '+' ? 1 : -1)
  return vector
}
// Map declared forward/up to Three +Z/+Y in a right-handed display basis.
// No geographic/world placement is inferred.
export function basisMatrix (frame: CoordinateFrame): Matrix4 {
  const up = axisVector(frame.upDirection)
  const forward = axisVector(frame.forwardDirection)
  return new Matrix4().makeBasis(up.clone().cross(forward), up, forward).transpose()
}
export function frameMatrix (frame: CoordinateFrame): Matrix4 {
  return basisMatrix(frame).multiply(new Matrix4().makeScale(frame.units.x.factor, frame.units.y.factor, frame.units.z.factor))
}
export function sourceToScene (frame: CoordinateFrame, point: Position): Vector3 {
  return new Vector3(point.x, point.y, point.z).applyMatrix4(frameMatrix(frame))
}
export function sceneMatrix (layout: SpatialLayout, asset: Placement, drafts: PositionDrafts = {}): Matrix4 {
  const p = drafts[asset.id] ?? asset.position
  const offset = layout.frame.offset
  return frameMatrix(layout.frame).setPosition(sourceToScene(layout.frame, { x: p.x + offset.x, y: p.y + offset.y, z: p.z + offset.z }))
}
export function sceneToLocalPosition (layout: SpatialLayout, _asset: Placement, scenePoint: Position): Position {
  const point = new Vector3(scenePoint.x, scenePoint.y, scenePoint.z).applyMatrix4(frameMatrix(layout.frame).invert())
  return { x: point.x - layout.frame.offset.x, y: point.y - layout.frame.offset.y, z: point.z - layout.frame.offset.z }
}
