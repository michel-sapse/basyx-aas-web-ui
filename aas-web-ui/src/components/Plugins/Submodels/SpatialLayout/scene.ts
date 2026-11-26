import type { Placement, Position, PositionDrafts, SpatialLayout } from './types'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { axisVector, basisMatrix, frameMatrix, sceneMatrix, sceneToLocalPosition, sourceToScene } from './coordinates'

export type SpatialView = 'isometric' | 'front' | 'side' | 'top'
type Callbacks = { select: (id: string) => void, move: (id: string, position: Position) => void, grid: (step: number) => void }
type AssetObjects = { actual: THREE.Group, saved: THREE.Group, reference: THREE.Group | null, material: THREE.MeshStandardMaterial }

function disposeObjects (object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  object.traverse(child => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry) {
      geometries.add(mesh.geometry)
    }
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material)
      }
    }
  })
  for (const geometry of geometries) {
    geometry.dispose()
  }
  for (const material of materials) {
    material.dispose()
  }
}

export function createSpatialScene (container: HTMLElement, initialLayout: SpatialLayout, callbacks: Callbacks) {
  const scene = new THREE.Scene()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x00_00_00, 0)
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute('aria-label', 'Rack and server spatial preview. Use coordinate fields for keyboard position editing.')
  container.append(renderer.domElement)
  const perspective = new THREE.PerspectiveCamera(45, 1, 0.001, 1000)
  const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 1000)
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspective
  const orbit = new OrbitControls<THREE.PerspectiveCamera | THREE.OrthographicCamera>(camera, renderer.domElement)
  orbit.enableDamping = true
  const transform = new TransformControls(camera, renderer.domElement)
  transform.setMode('translate')
  transform.setSpace('local')
  const proxy = new THREE.Object3D()
  scene.add(proxy, transform.getHelper())
  scene.add(new THREE.AmbientLight(0xff_ff_ff, 2))
  const light = new THREE.DirectionalLight(0xff_ff_ff, 3)
  light.position.set(3, 5, 4)
  scene.add(light)
  const content = new THREE.Group()
  scene.add(content)
  let layout = initialLayout
  let drafts: PositionDrafts = {}
  let selectedId = ''
  let editable = false
  let view: SpatialView = 'isometric'
  let geometryKey = ''
  let grid: THREE.GridHelper | null = null
  let axes: THREE.AxesHelper | null = null
  let frame = 0
  let disposed = false
  let orthoRadius = 1
  const objects = new Map<string, AssetObjects>()
  const deltaGeometry = new THREE.BufferGeometry()
  const deltaLine = new THREE.Line(deltaGeometry, new THREE.LineBasicMaterial({ color: 0xd9_6b_20, depthTest: false }))
  scene.add(deltaLine)

  function box (asset: Placement): THREE.BufferGeometry {
    if (asset.dimensions) {
      return new THREE.BoxGeometry(asset.dimensions.x, asset.dimensions.y, asset.dimensions.z)
    }
    // A point marker, not an inferred asset volume. Compensate per-axis units.
    const geometry = new THREE.OctahedronGeometry(0.018)
    geometry.scale(1 / layout.frame.units.x.factor, 1 / layout.frame.units.y.factor, 1 / layout.frame.units.z.factor)
    return geometry
  }
  function outline (geometry: THREE.BufferGeometry, color: number, opacity: number): THREE.Group {
    const group = new THREE.Group()
    group.matrixAutoUpdate = false
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false })))
    return group
  }
  function rebuild (): void {
    disposeObjects(content)
    content.clear()
    objects.clear()
    if (layout.area) {
      const points = layout.area.polygon.map(point => sourceToScene(layout.frame, point))
      if (!points[0]!.equals(points.at(-1)!)) {
        points.push(points[0]!.clone())
      }
      content.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x65_91_a6, depthTest: false })))
    }
    for (const asset of layout.assets) {
      const geometry = box(asset)
      const material = new THREE.MeshStandardMaterial({ color: 0x4c_8f_a5, transparent: true, opacity: 0.7, roughness: 0.7 })
      const actual = new THREE.Group()
      actual.matrixAutoUpdate = false
      actual.matrix.copy(sceneMatrix(layout, asset, drafts))
      actual.userData.assetId = asset.id
      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData.assetId = asset.id
      actual.add(mesh, new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x5d_82_91 })))
      if (Object.values(asset.rotation).every(value => value === 0)) {
        const direction = axisVector(layout.frame.forwardDirection)
        const axis = layout.frame.forwardDirection[1]!.toLowerCase() as keyof Position
        actual.add(new THREE.ArrowHelper(direction, new THREE.Vector3(), 0.12 / layout.frame.units[axis].factor, 0xe7_93_25))
      }
      const saved = outline(geometry, 0x85_8d_96, 0.6)
      saved.matrix.copy(sceneMatrix(layout, asset))
      const reference = asset.reference ? outline(geometry, 0x20_aa_80, 0.95) : null
      if (reference && asset.reference) {
        reference.matrix.copy(sceneMatrix(layout, asset, { ...drafts, [asset.id]: asset.reference }))
      }
      content.add(actual, saved)
      if (reference) {
        content.add(reference)
      }
      objects.set(asset.id, { actual, saved, reference, material })
    }
    if (grid) {
      scene.remove(grid)
      disposeObjects(grid)
    }
    if (axes) {
      scene.remove(axes)
      disposeObjects(axes)
    }
    content.updateMatrixWorld(true)
    const size = new THREE.Box3().setFromObject(content).getSize(new THREE.Vector3())
    const extent = Math.max(size.x, size.y, size.z, 0.1)
    const power = 10 ** Math.floor(Math.log10(extent / 10))
    const step = Math.ceil(extent / 10 / power) * power
    grid = new THREE.GridHelper(step * 30, 30, 0x9a_a9_b3, 0xcb_d5_dc)
    const origin = new THREE.Vector3().setFromMatrixPosition(frameMatrix(layout.frame))
    grid.position.copy(origin)
    scene.add(grid)
    axes = new THREE.AxesHelper(step * 4)
    axes.position.copy(origin)
    axes.quaternion.setFromRotationMatrix(new THREE.Matrix4().extractRotation(frameMatrix(layout.frame)))
    scene.add(axes)
    callbacks.grid(step)
  }
  function update (nextLayout: SpatialLayout, nextDrafts: PositionDrafts, nextSelected: string, canEdit: boolean): void {
    layout = nextLayout
    drafts = nextDrafts
    selectedId = nextSelected
    editable = canEdit
    const key = JSON.stringify([layout.frame, layout.area, layout.assets.map(asset => [asset.id, asset.dimensions, asset.rotation, Boolean(asset.reference)])])
    const rebuilt = key !== geometryKey
    if (rebuilt) {
      geometryKey = key
      rebuild()
    }
    for (const asset of layout.assets) {
      const object = objects.get(asset.id)!
      object.actual.matrix.copy(sceneMatrix(layout, asset, drafts))
      object.saved.matrix.copy(sceneMatrix(layout, asset))
      object.saved.visible = !object.actual.matrix.elements.every((value, index) => Math.abs(value - object.saved.matrix.elements[index]!) < 1e-10)
      object.material.color.setHex(asset.id === selectedId ? 0x00_88_a8 : 0x4c_8f_a5)
      if (object.reference && asset.reference) {
        object.reference.matrix.copy(sceneMatrix(layout, asset, { ...drafts, [asset.id]: asset.reference }))
        object.reference.visible = asset.id === selectedId
      }
    }
    content.updateMatrixWorld(true)
    const selected = layout.assets.find(asset => asset.id === selectedId)
    deltaLine.visible = Boolean(selected?.reference)
    if (selected?.reference) {
      const actual = new THREE.Vector3().setFromMatrixPosition(sceneMatrix(layout, selected, drafts))
      const reference = new THREE.Vector3().setFromMatrixPosition(sceneMatrix(layout, selected, { ...drafts, [selected.id]: selected.reference }))
      deltaGeometry.setFromPoints([actual, reference])
    }
    if (selected && editable) {
      if (!transform.dragging) {
        proxy.position.setFromMatrixPosition(sceneMatrix(layout, selected, drafts))
        proxy.quaternion.setFromRotationMatrix(basisMatrix(layout.frame))
      }
      transform.attach(proxy)
    } else {
      transform.detach()
    }
    if (rebuilt) {
      fit(false)
    }
  }
  function fit (selectedOnly: boolean): void {
    const bounds = new THREE.Box3()
    if (selectedOnly && objects.has(selectedId)) {
      const object = objects.get(selectedId)!
      bounds.setFromObject(object.actual)
      if (object.saved.visible) {
        bounds.expandByObject(object.saved)
      }
      if (object.reference) {
        bounds.expandByObject(object.reference)
      }
    } else {
      bounds.setFromObject(content)
    }
    if (bounds.isEmpty()) {
      return
    }
    const sphere = bounds.getBoundingSphere(new THREE.Sphere())
    const radius = Math.max(sphere.radius, 0.03) * 1.35
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(22.5))
    let direction = new THREE.Vector3(1, 0.75, 1).normalize()
    if (view === 'front') {
      direction = new THREE.Vector3(0, 0, 1)
    }
    if (view === 'side') {
      direction = new THREE.Vector3(1, 0, 0)
    }
    if (view === 'top') {
      direction = new THREE.Vector3(0, 1, 0)
    }
    camera.up.set(0, view === 'top' ? 0 : 1, view === 'top' ? -1 : 0)
    camera.position.copy(sphere.center).addScaledVector(direction, distance)
    orbit.target.copy(sphere.center)
    camera.near = Math.max(distance / 1000, 0.00001)
    camera.far = Math.max(distance * 100, 100)
    orthoRadius = radius
    orbit.minDistance = radius * 0.05
    orbit.maxDistance = distance * 100
    resize()
    orbit.update()
  }
  function setView (next: SpatialView): void {
    view = next
    camera = next === 'isometric' ? perspective : orthographic
    orbit.object = camera
    transform.camera = camera
    fit(false)
  }
  function resize (): void {
    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    renderer.setSize(width, height)
    perspective.aspect = width / height
    orthographic.left = -orthoRadius * width / height
    orthographic.right = orthoRadius * width / height
    orthographic.top = orthoRadius
    orthographic.bottom = -orthoRadius
    camera.updateProjectionMatrix()
  }
  transform.addEventListener('dragging-changed', event => {
    orbit.enabled = !event.value
  })
  transform.addEventListener('objectChange', () => {
    const asset = layout.assets.find(candidate => candidate.id === selectedId)
    if (asset && editable) {
      callbacks.move(asset.id, sceneToLocalPosition(layout, asset, proxy.position))
    }
  })
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let down: { x: number, y: number } | null = null
  const pointerDown = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY }
  }
  const pointerUp = (event: PointerEvent) => {
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5 || transform.dragging || transform.axis) {
      return
    }
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit_ = raycaster.intersectObjects([...objects.values()].map(object => object.actual), true).find(hit => hit.object.userData.assetId)
    const hit = hit_
    if (hit) {
      callbacks.select(hit.object.userData.assetId)
    }
  }
  renderer.domElement.addEventListener('pointerdown', pointerDown)
  renderer.domElement.addEventListener('pointerup', pointerUp)
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  function animate (): void {
    if (disposed) {
      return
    }
    frame = requestAnimationFrame(animate)
    orbit.update()
    renderer.render(scene, camera)
  }
  resize()
  animate()
  return {
    update, setView,
    fitLayout: () => fit(false), focusSelected: () => fit(true),
    dispose () {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', pointerDown)
      renderer.domElement.removeEventListener('pointerup', pointerUp)
      orbit.dispose()
      transform.dispose()
      disposeObjects(scene)
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
