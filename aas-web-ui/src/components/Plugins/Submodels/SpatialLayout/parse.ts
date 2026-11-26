import { type AasElement, AXES, type CoordinateFrame, type Placement, type Position, type PositionText, type SignedAxis, SPATIAL_LAYOUT_SEMANTIC_ID, type SpatialLayout, type Unit } from './types'

export function child (element: AasElement, name: string, optional = false): AasElement {
  const entries = element.modelType === 'Submodel' ? element.submodelElements : element.value
  const matches = Array.isArray(entries) ? entries.filter((entry: AasElement) => entry.idShort === name) : []
  if (matches.length > 1) {
    throw new Error('Duplicate ' + name + '.')
  }
  if (matches.length === 0 && !optional) {
    throw new Error('Missing ' + name + ' in ' + (element.idShort || 'position entry') + '.')
  }
  return matches[0]
}
function text (element: AasElement, name: string): string {
  const p = child(element, name)
  if (p.modelType !== 'Property' || typeof p.value !== 'string') {
    throw new Error(name + ' must be a Property with a value.')
  }
  return p.value
}
export function coordinateNumber (value: unknown): number | null {
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    return null
  }
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
function number (element: AasElement, name: string): number {
  const p = child(element, name)
  if (p.modelType !== 'Property' || !['xs:double', 'xs:float', 'xs:decimal'].includes(p.valueType)) {
    throw new Error(name + ' must be a numeric Property.')
  }
  const result = coordinateNumber(p.value)
  if (result === null) {
    throw new Error(name + ' must contain a finite number.')
  }
  return result
}
function vector (element: AasElement): Position {
  if (element.modelType !== 'SubmodelElementCollection') {
    throw new Error('Coordinates must be a collection.')
  }
  return { x: number(element, 'Xvalue'), y: number(element, 'Yvalue'), z: number(element, 'Zvalue') }
}
function keys (element: AasElement, name: string): Array<{ type: string, value: string }> {
  const reference = child(element, name)
  if (reference.modelType !== 'ReferenceElement' || reference.value?.type !== 'ModelReference' || !Array.isArray(reference.value.keys)) {
    throw new Error(name + ' must be a ModelReference.')
  }
  return reference.value.keys
}
function localFrame (element: AasElement, id: string): void {
  const ref = keys(element, 'CoordinateSystemReference')
  if (ref.length !== 2 || ref[0]?.type !== 'Submodel' || ref[0].value !== id || ref[1]?.type !== 'SubmodelElementCollection' || ref[1].value !== 'CoordinateSystem') {
    throw new Error('External coordinate systems are not supported yet. Use this submodel’s CoordinateSystem.')
  }
}
function unit (units: AasElement, name: string, physicalUnit: string): Unit {
  const element = child(units, name)
  const reference = child(element, 'PhysicalUnit')
  const refKeys = reference.value?.keys
  if (reference.modelType !== 'ReferenceElement' || reference.value?.type !== 'ExternalReference' || refKeys?.length !== 1 || refKeys[0].value !== physicalUnit) {
    throw new Error(name + ' has an unsupported physical base unit.')
  }
  const factor = number(element, 'MultiplyingFactor')
  if (factor <= 0) {
    throw new Error(name + ' must have a positive multiplying factor.')
  }
  return { name: text(element, 'Name'), factor, physicalUnit }
}
function direction (element: AasElement, name: string): SignedAxis {
  const value = text(element, name)
  if (!/^[+-][XYZ]$/.test(value)) {
    throw new Error(name + ' must be a signed axis such as +Z.')
  }
  return value as SignedAxis
}
export function parseSpatialLayout (submodel: AasElement, path = submodel.path || ''): SpatialLayout {
  if (submodel.modelType !== 'Submodel' || typeof submodel.id !== 'string' || !submodel.id
    || !submodel.semanticId?.keys?.some((key: AasElement) => key.value === SPATIAL_LAYOUT_SEMANTIC_ID)) {
    throw new Error('An Asset Positional Data submodel is required.')
  }
  const system = child(submodel, 'CoordinateSystem')
  if (text(system, 'CoordinateSystemType') !== 'Cartesian') {
    throw new Error('Only Cartesian coordinate systems are supported.')
  }
  const units = child(system, 'Units')
  const upDirection = direction(system, 'UpDirection')
  const forwardDirection = direction(system, 'ForwardDirection')
  if (upDirection[1] === forwardDirection[1]) {
    throw new Error('Up and forward directions must be orthogonal.')
  }
  const offset = child(submodel, 'PositionsOffset', true)
  if (offset) {
    localFrame(offset, submodel.id)
  }
  const frame: CoordinateFrame = {
    name: text(system, 'CoordinateSystemName'),
    units: { x: unit(units, 'LengthUnitX', '0173-1#05-AAA551#006'), y: unit(units, 'LengthUnitY', '0173-1#05-AAA551#006'), z: unit(units, 'LengthUnitZ', '0173-1#05-AAA551#006') },
    upDirection, forwardDirection, angleUnit: unit(units, 'AngleUnit', '0173-1#05-AAA117#005'),
    rotationOrder: child(system, 'EulerAnglesOrder', true) ? text(system, 'EulerAnglesOrder') : 'YPR',
    offset: offset ? vector(child(offset, 'CartesianCoordinates')) : { x: 0, y: 0, z: 0 },
  }
  if (!['YPR', 'YRP', 'PYR', 'PRY', 'RYP', 'RPY'].includes(frame.rotationOrder)) {
    throw new Error('Invalid EulerAnglesOrder.')
  }
  const positions = child(submodel, 'Positions')
  if (positions.modelType !== 'SubmodelElementList' || !Array.isArray(positions.value) || positions.value.length === 0) {
    throw new Error('No asset positions found.')
  }
  const warnings: string[] = []
  const assets: Placement[] = positions.value.map((entry: AasElement, index: number) => {
    if (entry.modelType !== 'SubmodelElementCollection') {
      throw new Error('Each position must be a collection.')
    }
    const assetKeys = keys(entry, 'Asset')
    if (assetKeys.length !== 1 || assetKeys[0]?.type !== 'AssetAdministrationShell' || !assetKeys[0].value) {
      throw new Error('Asset must identify an AAS shell.')
    }
    localFrame(entry, submodel.id)
    const orientation = child(entry, 'EulerAngles')
    const rotation = { yaw: number(orientation, 'Yaw'), pitch: number(orientation, 'Pitch'), roll: number(orientation, 'Roll') }
    if (Object.values(rotation).some(value => value !== 0)) {
      warnings.push('Nonzero orientation for ' + assetKeys[0].value + ' is retained but not rendered: yaw/pitch/roll axis conventions require confirmation.')
    }
    const positionElement = child(entry, 'CartesianCoordinates')
    const preview = child(entry, 'PreviewGeometry', true)
    const dimensions = preview ? vector(preview) : null
    if (dimensions && Object.values(dimensions).some(value => value <= 0)) {
      throw new Error('PreviewGeometry spans must be positive.')
    }
    return {
      id: assetKeys[0].value, aasId: assetKeys[0].value,
      name: child(entry, 'PreviewName', true) ? text(entry, 'PreviewName') : assetKeys[0].value.split(':').pop()!,
      position: vector(positionElement), rotation, dimensions,
      reference: child(entry, 'MountingReference', true) ? vector(child(entry, 'MountingReference')) : null,
      positionElement, positionPath: path ? path + '/submodel-elements/Positions[' + index + '].CartesianCoordinates' : '',
    }
  })
  if (new Set(assets.map(asset => asset.id)).size !== assets.length) {
    throw new Error('Asset identities in Positions must be unique.')
  }
  const areaElement = child(submodel, 'Area', true)
  let area: SpatialLayout['area'] = null
  if (areaElement && child(areaElement, 'SurfacePolygon', true)) {
    const surface = child(areaElement, 'SurfacePolygon')
    localFrame(surface, submodel.id)
    const plane = text(surface, 'Plane')
    if (!['XY', 'XZ', 'YZ'].includes(plane)) {
      throw new Error('Unsupported polygon plane.')
    }
    const points = child(surface, 'PolygonCoordinates')
    if (points.modelType !== 'SubmodelElementList' || !Array.isArray(points.value) || points.value.length < 3) {
      throw new Error('Surface polygon needs at least three points.')
    }
    area = { name: text(areaElement, 'Name'), type: text(areaElement, 'Type'), polygon: points.value.map((point: AasElement) => ({ x: 0, y: 0, z: 0, [plane[0].toLowerCase()]: number(point, 'Xvalue'), [plane[1].toLowerCase()]: number(point, 'Yvalue') })) }
  }
  return { id: submodel.id, path, frame, area, assets, warnings }
}
export function samePosition (a: Position, b: Position): boolean {
  return AXES.every(axis => Math.abs(a[axis] - b[axis]) <= 1e-8)
}
export function positionText (position: Position): PositionText {
  return { x: String(position.x), y: String(position.y), z: String(position.z) }
}
