import type { SignedAxis } from '@/components/Plugins/Submodels/SpatialLayout/types'
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { basisMatrix, sceneMatrix, sceneToLocalPosition, sourceToScene } from '@/components/Plugins/Submodels/SpatialLayout/coordinates'
import { parseSpatialLayout } from '@/components/Plugins/Submodels/SpatialLayout/parse'
import { sample } from './fixtures'

describe('placement coordinate mapping', () => {
  it('moves 22 to 20 by exactly two rack units (88.9 mm), preserving x/y', () => {
    const layout = parseSpatialLayout(sample())
    const asset = layout.assets[0]!
    const saved = new Vector3().setFromMatrixPosition(sceneMatrix(layout, asset))
    const draft = new Vector3().setFromMatrixPosition(sceneMatrix(layout, asset, { [asset.id]: { x: 0, y: 0, z: 20 } }))
    expect(saved.y - draft.y).toBeCloseTo(0.0889, 10)
    expect(saved.x).toBe(draft.x)
    expect(saved.z).toBe(draft.z)
    expect(saved.y).toBeCloseTo((22 + 2.18) * 0.04445)
    expect(saved.z).toBeCloseTo(-0.8)
  })
  it('inverts mixed units and offsets for negative, zero and fractional values', () => {
    const layout = parseSpatialLayout(sample())
    const asset = layout.assets[0]!
    const draft = { x: -2.25, y: 0, z: 20.125 }
    const scene = new Vector3().setFromMatrixPosition(sceneMatrix(layout, asset, { [asset.id]: draft }))
    const restored = sceneToLocalPosition(layout, asset, scene)
    expect(restored.x).toBeCloseTo(draft.x, 12)
    expect(restored.y).toBeCloseTo(draft.y, 12)
    expect(restored.z).toBeCloseTo(draft.z, 12)
  })
  it('maps the polygon with plane units and without the asset offset', () => {
    const layout = parseSpatialLayout(sample())
    const point = sourceToScene(layout.frame, layout.area!.polygon[2]!)
    expect(point.x).toBeCloseTo(0.597)
    expect(point.y).toBeCloseTo(45.2 * 0.04445)
    expect(point.z).toBe(0)
  })
  it('supports signed up/forward axes without changing handedness', () => {
    for (const up of ['+X', '-X', '+Y', '-Y', '+Z', '-Z'] as SignedAxis[]) {
      for (const forward of ['+X', '-X', '+Y', '-Y', '+Z', '-Z'] as SignedAxis[]) {
        if (up[1] === forward[1]) {
          continue
        }
        const layout = parseSpatialLayout(sample())
        layout.frame.upDirection = up
        layout.frame.forwardDirection = forward
        expect(basisMatrix(layout.frame).determinant()).toBeCloseTo(1)
        const asset = layout.assets[0]!
        const scene = new Vector3().setFromMatrixPosition(sceneMatrix(layout, asset))
        expect(sceneToLocalPosition(layout, asset, scene).z).toBeCloseTo(22)
      }
    }
  })
})
