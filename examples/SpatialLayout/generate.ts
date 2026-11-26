// From aas-web-ui: pnpm exec node ../examples/SpatialLayout/generate.ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../../aas-web-ui/package.json', import.meta.url))
const { jsonization, xmlization } = require('@aas-core-works/aas-core3.1-typescript')
const { NewPackaging } = require('aas-package3-typescript')
type Element = Record<string, any>
const directory = new URL('./', import.meta.url)
const source = JSON.parse(await readFile(new URL('PositionalData.json', directory), 'utf8'))
jsonization.submodelFromJsonable(source).mustValue()
const submodel = structuredClone(source)
const layoutId = 'urn:basyx:demo:positional-data'
function updateReferences (element: any): void {
  if (!element || typeof element !== 'object') return
  if (element.type === 'Submodel' && element.value === source.id) element.value = layoutId
  for (const value of Object.values(element)) updateReferences(value)
}
updateReferences(submodel)
submodel.id = layoutId
submodel.description = [{ language: 'en', text: 'Synthetic rack/server correction demo adapted from the supplied PositionalData sample. PreviewName, PreviewGeometry and MountingReference are demo extensions.' }]
const child = (element: Element, name: string) => (element.submodelElements || element.value).find((item: Element) => item.idShort === name)
const property = (idShort: string, value: string): Element => ({ modelType: 'Property', idShort, valueType: 'xs:string', value })
function vector (idShort: string, x: number, y: number, z: number, text: string): Element {
  return {
    modelType: 'SubmodelElementCollection', idShort, description: [{ language: 'en', text }],
    semanticId: { type: 'ExternalReference', keys: [{ type: 'GlobalReference', value: 'urn:basyx:demo:positional-data:' + idShort }] },
    value: ['Xvalue', 'Yvalue', 'Zvalue'].map((name, index) => ({ modelType: 'Property', idShort: name, valueType: 'xs:double', value: String([x, y, z][index]) })),
  }
}
const positions = child(submodel, 'Positions')
const server = positions.value[0]
child(server, 'Asset').value.keys[0].value = 'urn:basyx:demo:aas:Server01'
server.value.push(property('PreviewName', 'Server 01 · offset demo'))
server.value.push(vector('PreviewGeometry', 0.55, 0.42, 2, 'Synthetic centered axis-aligned schematic spans in the declared axis units. Not actual CAD geometry.'))
server.value.push(vector('MountingReference', 0, 0, 20, 'Synthetic known mounting coordinates BEFORE PositionsOffset; axis units apply.'))
const second = structuredClone(server)
child(second, 'Asset').value.keys[0].value = 'urn:basyx:demo:aas:Server02'
child(second, 'PreviewName').value = 'Server 02'
child(child(second, 'CartesianCoordinates'), 'Zvalue').value = '28.0'
child(child(second, 'MountingReference'), 'Zvalue').value = '28'
positions.value.push(second)
const environment = {
  assetAdministrationShells: ['RackDemo', 'Server01', 'Server02'].map(id => ({
    modelType: 'AssetAdministrationShell', idShort: id, id: 'urn:basyx:demo:aas:' + id,
    description: [{ language: 'en', text: 'Synthetic spatial-layout demo shell. RackDemo represents the Area polygon.' }],
    assetInformation: { assetKind: 'Instance', globalAssetId: 'urn:basyx:demo:asset:' + id },
    submodels: [{ type: 'ModelReference', keys: [{ type: 'Submodel', value: layoutId }] }],
  })),
  submodels: [submodel],
}
const typed = jsonization.environmentFromJsonable(environment).mustValue()

await mkdir(new URL('aas/', directory), { recursive: true })
await writeFile(new URL('environment.json', directory), JSON.stringify(environment, null, 2) + '\n')
const pkg = await NewPackaging().Create(fileURLToPath(new URL('aas/SpatialLayoutDemo.aasx', directory)))
try {
  const content = xmlization.toXmlString(typed)
  const spec = await pkg.PutPart(new URL('https://package.local/aasx/xml/content.xml'), 'application/xml', new TextEncoder().encode(content))
  await pkg.MakeSpec(spec)
  await pkg.Flush()
} finally { pkg.Close() }
console.log('Generated environment.json and aas/SpatialLayoutDemo.aasx')
