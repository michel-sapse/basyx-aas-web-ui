import { jsonization } from '@aas-core-works/aas-core3.1-typescript'
import { describe, expect, it } from 'vitest'
import { coordinateNumber, parseSpatialLayout } from '@/components/Plugins/Submodels/SpatialLayout/parse'
import { child, coordinates, demo, entry, path, sample } from './fixtures'

describe('Asset Positional Data parsing', () => {
  it('reads the supplied mixed-unit, offset sample without invented geometry', () => {
    const data = sample()
    expect(jsonization.submodelFromJsonable(data).mustValue()).toBeDefined()
    const layout = parseSpatialLayout(data, path)
    expect(layout.frame.units.x).toMatchObject({ name: 'Metre', factor: 1 })
    expect(layout.frame.units.z).toMatchObject({ name: 'Rack Unit', factor: 0.04445 })
    expect(layout.frame).toMatchObject({ upDirection: '+Z', forwardDirection: '+X', offset: { x: -0.8, y: 0.06, z: 2.18 }, rotationOrder: 'YPR' })
    expect(layout.assets[0]).toMatchObject({ aasId: 'urn:apeirora.eu:idcm:aas:S800-XAN-LXC-00500', position: { x: 0, y: 0, z: 22 }, dimensions: null, reference: null, positionPath: path + '/submodel-elements/Positions[0].CartesianCoordinates' })
    expect(layout.area?.polygon[2]).toEqual({ x: 0, y: 0.597, z: 45.2 })
  })
  it('uses authored demo targets and two distinct asset references', () => {
    const layout = parseSpatialLayout(demo(), path)
    expect(layout.assets).toHaveLength(2)
    expect(layout.assets[0]?.reference?.z).toBe(20)
    expect(layout.assets[0]?.dimensions).toEqual({ x: 0.55, y: 0.42, z: 2 })
    expect(layout.assets[0]?.id).not.toBe(layout.assets[1]?.id)
  })
  it.each(['', 'NaN', 'Infinity', '0x10', '1,2', '1e309'])('rejects invalid numeric input %s', value => {
    expect(coordinateNumber(value)).toBeNull()
  })
  it.each(['-2.25', '+0', '.5', '1e-3', ' 20 '])('accepts finite numeric input %s', value => {
    expect(coordinateNumber(value)).toBe(Number(value))
  })
  it('rejects missing coordinates instead of substituting zero', () => {
    const data = sample()
    coordinates(data).value.pop()
    expect(() => parseSpatialLayout(data)).toThrow('Missing Zvalue')
  })
  it('rejects duplicate identities and unresolved external frames', () => {
    const data = demo()
    child(entry(data, 1), 'Asset').value = structuredClone(child(entry(data), 'Asset').value)
    expect(() => parseSpatialLayout(data)).toThrow('unique')
    const external = sample()
    child(entry(external), 'CoordinateSystemReference').value.keys[0].value = 'urn:unknown'
    expect(() => parseSpatialLayout(external)).toThrow('External coordinate systems')
  })
  it('rejects invalid units and parallel up/forward axes', () => {
    const data = sample()
    child(child(child(data, 'CoordinateSystem'), 'Units'), 'LengthUnitZ').value[1].value = '0'
    expect(() => parseSpatialLayout(data)).toThrow('positive')
    const parallel = sample()
    child(child(parallel, 'CoordinateSystem'), 'UpDirection').value = '-X'
    expect(() => parseSpatialLayout(parallel)).toThrow('orthogonal')
  })
  it('flags unverified nonzero orientation while retaining its exact values', () => {
    const data = sample()
    child(child(entry(data), 'EulerAngles'), 'Yaw').value = '45'
    const layout = parseSpatialLayout(data)
    expect(layout.assets[0]?.rotation.yaw).toBe(45)
    expect(layout.warnings[0]).toContain('not rendered')
  })
})
