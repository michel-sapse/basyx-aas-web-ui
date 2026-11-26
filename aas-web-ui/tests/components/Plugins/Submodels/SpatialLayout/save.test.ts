import { jsonization } from '@aas-core-works/aas-core3.1-typescript'
import { describe, expect, it, vi } from 'vitest'
import { parseSpatialLayout } from '@/components/Plugins/Submodels/SpatialLayout/parse'
import { savePlacement } from '@/components/Plugins/Submodels/SpatialLayout/save'
import { child, coordinates, demo, path } from './fixtures'

describe('explicit placement persistence', () => {
  it('writes only Z, preserving lexical x/y, metadata, angles and the shared offset', async () => {
    const data = demo()
    const position = coordinates(data)
    child(position, 'Xvalue').value = '0.000'
    child(position, 'Zvalue').description = [{ language: 'en', text: 'Keep this metadata' }]
    const before = structuredClone(data)
    const layout = parseSpatialLayout(data, path)
    const read = vi.fn(async () => structuredClone(data))
    const write = vi.fn(async (element, endpoint) => {
      expect(endpoint).toBe(path + '/submodel-elements/Positions[0].CartesianCoordinates')
      expect(jsonization.submodelElementFromJsonable(element).mustValue()).toBeDefined()
      coordinates(data).value = structuredClone(element.value)
      return true
    })
    const confirmed = await savePlacement(layout, layout.assets[0]!.id, { x: 0, y: 0, z: 20 }, { read, write })
    expect(confirmed.assets[0]?.position.z).toBe(20)
    expect(write).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledTimes(2)
    const expected = structuredClone(before)
    child(coordinates(expected), 'Zvalue').value = '20'
    expect(data).toEqual(expected)
    expect(layout.assets[0]?.position.z).toBe(22)
  })
  it('resolves a reordered list by stable asset identity before writing', async () => {
    const data = demo()
    const layout = parseSpatialLayout(data, path)
    child(data, 'Positions').value.reverse()
    const write = vi.fn(async (element, endpoint) => {
      expect(endpoint).toContain('Positions[1].CartesianCoordinates')
      coordinates(data, 1).value = element.value
      return true
    })
    await savePlacement(layout, layout.assets[0]!.id, { x: 0, y: 0, z: 20 }, { read: async () => structuredClone(data), write })
    expect(child(coordinates(data), 'Zvalue').value).toBe('28.0')
  })
  it.each(['coordinate', 'offset', 'unit', 'orientation'])('rejects a concurrent %s change without writing', async change => {
    const data = demo()
    const layout = parseSpatialLayout(data, path)
    if (change === 'coordinate') {
      child(coordinates(data), 'Zvalue').value = '23'
    }
    if (change === 'offset') {
      child(child(child(data, 'PositionsOffset'), 'CartesianCoordinates'), 'Zvalue').value = '3'
    }
    if (change === 'unit') {
      child(child(child(child(data, 'CoordinateSystem'), 'Units'), 'LengthUnitZ'), 'MultiplyingFactor').value = '0.05'
    }
    if (change === 'orientation') {
      child(child(child(data, 'Positions').value[0], 'EulerAngles'), 'Yaw').value = '30'
    }
    const write = vi.fn()
    await expect(savePlacement(layout, layout.assets[0]!.id, { x: 0, y: 0, z: 20 }, { read: async () => data, write })).rejects.toThrow('changed')
    expect(write).not.toHaveBeenCalled()
  })
  it('reports failed and unconfirmed saves', async () => {
    const data = demo()
    const layout = parseSpatialLayout(data, path)
    const read = async () => structuredClone(data)
    await expect(savePlacement(layout, layout.assets[0]!.id, { x: 0, y: 0, z: 20 }, { read, write: async () => false })).rejects.toThrow('draft has been retained')
    await expect(savePlacement(layout, layout.assets[0]!.id, { x: 0, y: 0, z: 20 }, { read, write: async () => true })).rejects.toThrow('did not confirm')
    expect(child(coordinates(data), 'Zvalue').value).toBe('22.0')
  })
  it('rejects nonfinite coordinates before any network call', async () => {
    const layout = parseSpatialLayout(demo(), path)
    const io = { read: vi.fn(), write: vi.fn() }
    await expect(savePlacement(layout, layout.assets[0]!.id, { x: 0, y: Number.NaN, z: 20 }, io)).rejects.toThrow('finite')
    expect(io.read).not.toHaveBeenCalled()
    expect(io.write).not.toHaveBeenCalled()
  })
})
