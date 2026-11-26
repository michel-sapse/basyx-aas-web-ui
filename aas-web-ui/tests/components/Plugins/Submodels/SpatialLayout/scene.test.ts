import type * as Three from 'three'
import { BufferGeometry, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseSpatialLayout } from '@/components/Plugins/Submodels/SpatialLayout/parse'
import { createSpatialScene } from '@/components/Plugins/Submodels/SpatialLayout/scene'
import { demo } from './fixtures'

const mocks = vi.hoisted(() => ({ scene: null as Three.Scene | null, controls: null as any, dispose: vi.fn(), disconnect: vi.fn(), cancelFrame: vi.fn() }))
vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof Three>(),
  WebGLRenderer: class {
    domElement = document.createElement('canvas')
    setPixelRatio () {}
    setClearColor () {}
    setSize () {}
    render (scene: Three.Scene) {
      mocks.scene = scene
    }

    dispose () {
      mocks.dispose()
    }
  },
}))
vi.mock('three/examples/jsm/controls/OrbitControls.js', async () => {
  const { Vector3 } = await import('three')
  return { OrbitControls: class {
    target = new Vector3()
    object: Three.Camera
    constructor (camera: Three.Camera) {
      this.object = camera
    }

    update () {
      this.object.lookAt(this.target)
    }

    dispose () {}
  } }
})
vi.mock('three/examples/jsm/controls/TransformControls.js', async () => {
  const { EventDispatcher, Group } = await import('three')
  return { TransformControls: class extends EventDispatcher {
    object: Three.Object3D | null = null
    camera: Three.Camera
    dragging = false
    axis = null
    constructor (camera: Three.Camera) {
      super()
      this.camera = camera
      mocks.controls = this
    }

    setMode () {}
    setSpace () {}
    getHelper () {
      return new Group()
    }

    attach (object: Three.Object3D) {
      this.object = object
    }

    detach () {
      this.object = null
    }

    dispose () {}
  } }
})

describe('shared spatial scene', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', class {
      observe () {}; disconnect () {
        mocks.disconnect()
      }
    })
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', mocks.cancelFrame)
  })
  afterEach(() => vi.unstubAllGlobals())
  it('maps axis dragging back to rack units, preserves x/y and detaches when read-only', () => {
    const layout = parseSpatialLayout(demo())
    const asset = layout.assets[0]!
    const move = vi.fn()
    const grid = vi.fn()
    const session = createSpatialScene(document.createElement('div'), layout, { select: vi.fn(), move, grid })
    session.update(layout, {}, asset.id, true)
    const proxy = mocks.controls.object as Three.Object3D
    expect(new Vector3(1, 0, 0).applyQuaternion(proxy.quaternion).z).toBeCloseTo(1)
    proxy.position.y -= 0.0889
    mocks.controls.dispatchEvent({ type: 'objectChange' })
    const position = move.mock.calls[0]![1]
    expect(position.x).toBeCloseTo(0)
    expect(position.y).toBeCloseTo(0)
    expect(position.z).toBeCloseTo(20)
    expect(grid.mock.calls[0]![0]).toBeGreaterThan(0)
    session.update(layout, {}, asset.id, false)
    expect(mocks.controls.object).toBeNull()
    session.dispose()
  })
  it('keeps a shared frame and provides front/side/top cameras and tighter selection framing', () => {
    const layout = parseSpatialLayout(demo())
    const session = createSpatialScene(document.createElement('div'), layout, { select: vi.fn(), move: vi.fn(), grid: vi.fn() })
    session.update(layout, {}, layout.assets[0]!.id, true)
    const anchors: Three.Object3D[] = []
    mocks.scene!.traverse(object => {
      if (object.type === 'Group' && object.userData.assetId) {
        anchors.push(object)
      }
    })
    expect(anchors).toHaveLength(2)
    const first = new Vector3().setFromMatrixPosition(anchors[0]!.matrix)
    const second = new Vector3().setFromMatrixPosition(anchors[1]!.matrix)
    expect(second.y - first.y).toBeCloseTo(6 * 0.04445)
    session.setView('front')
    const camera = mocks.controls.camera as Three.OrthographicCamera
    expect(camera.isOrthographicCamera).toBe(true)
    const fullHeight = camera.top - camera.bottom
    session.focusSelected()
    expect(camera.top - camera.bottom).toBeLessThan(fullHeight)
    session.setView('side')
    session.setView('top')
    expect(camera.up.z).toBe(-1)
    session.setView('isometric')
    expect(mocks.controls.camera.isPerspectiveCamera).toBe(true)
    session.dispose()
  })
  it('releases the renderer, listeners, observer and geometry on unmount', () => {
    const disposeGeometry = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const layout = parseSpatialLayout(demo())
    const container = document.createElement('div')
    const session = createSpatialScene(container, layout, { select: vi.fn(), move: vi.fn(), grid: vi.fn() })
    session.update(layout, {}, layout.assets[0]!.id, true)
    session.dispose()
    expect(mocks.dispose).toHaveBeenCalledTimes(1)
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
    expect(mocks.cancelFrame).toHaveBeenCalledWith(1)
    expect(disposeGeometry).toHaveBeenCalled()
    expect(container.querySelector('canvas')).toBeNull()
    disposeGeometry.mockRestore()
  })
})
