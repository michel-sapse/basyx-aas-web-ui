import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { jsonization, xmlization } from '@aas-core-works/aas-core3.1-typescript'
import { NewPackaging } from 'aas-package3-typescript'
import { describe, expect, it } from 'vitest'
import environment from '../../../../../../examples/SpatialLayout/environment.json'

describe('spatial demo artifacts', () => {
  it('contains typed AAS shells resolving every demo asset and the shared submodel', () => {
    expect(jsonization.environmentFromJsonable(environment as unknown as jsonization.JsonObject).mustValue()).toBeDefined()
    const id = environment.submodels[0]!.id
    expect(environment.assetAdministrationShells).toHaveLength(3)
    for (const aas of environment.assetAdministrationShells) {
      expect(aas.submodels[0]?.keys[0]?.value).toBe(id)
    }
  })
  it('packages a readable XML spec with the correct list, units and coordinates', async () => {
    const bytes = await readFile(resolve(process.cwd(), '../examples/SpatialLayout/aas/SpatialLayoutDemo.aasx'))
    const pkg = await NewPackaging().OpenReadFromBytes(new Uint8Array(bytes))
    try {
      const specs = await pkg.SpecsByContentType()
      expect(specs['application/xml']).toHaveLength(1)
      const content = specs['application/xml']![0]!.ReadAllText()
      const parsed = xmlization.fromXmlString(content).mustValue()
      const expected = jsonization.environmentFromJsonable(environment as unknown as jsonization.JsonObject).mustValue()
      expect(jsonization.toJsonable(parsed)).toEqual(jsonization.toJsonable(expected))
      const xml = new DOMParser().parseFromString(content, 'application/xml')
      expect(xml.querySelector('parsererror')).toBeNull()
      expect(xml.documentElement.namespaceURI).toBe('https://admin-shell.io/aas/3/1')
      const submodel = xml.querySelector('environment > submodels > submodel')!
      expect(submodel.querySelector(':scope > id')?.textContent).toBe(environment.submodels[0]!.id)
      const positions = [...submodel.querySelectorAll(':scope > submodelElements > submodelElementList')].find(element => element.querySelector(':scope > idShort')?.textContent === 'Positions')!
      expect(positions.querySelectorAll(':scope > value > submodelElementCollection')).toHaveLength(2)
      expect(xml.documentElement.textContent).toContain('0.04445')
      expect(xml.querySelectorAll('assetAdministrationShell')).toHaveLength(3)
    } finally {
      pkg.Close()
    }
  })
})
