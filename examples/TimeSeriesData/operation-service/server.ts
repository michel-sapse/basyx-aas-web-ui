import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

const samples = [
  { timestamp: '2026-11-24T09:00:00Z', temperature: '20.5' },
  { timestamp: '2026-11-24T09:05:00Z', temperature: '21.0' },
  { timestamp: '2026-11-24T09:10:00Z', temperature: '21.5' },
]

type Variable = { value: { idShort?: string, modelType?: string, valueType?: string, min?: string, max?: string, value?: unknown } }

function parseTimestamp (value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error('Timespan bounds must be date-times with Z or an explicit offset.')
  }
  const time = Date.parse(value)
  // Reject impossible calendar dates that Date.parse would otherwise normalize.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const calendar = new Date(0)
  calendar.setUTCFullYear(year, month - 1, day)
  if (!Number.isFinite(time) || year < 1 || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new Error('Timespan contains an invalid date-time.')
  }
  return time
}

export function execute (input: unknown) {
  if (!Array.isArray(input) || input.some(item => !item || typeof item !== 'object' || !item.value)) {
    throw new Error('Expected an array of AAS OperationVariables.')
  }
  const variables = input as Variable[]
  const spans = variables.filter(item => item.value.idShort === 'Timespan')
  if (spans.length !== 1 || spans[0].value.modelType !== 'Range' || spans[0].value.valueType !== 'xs:dateTime') {
    throw new Error('Exactly one Timespan Range<xs:dateTime> is required.')
  }
  const start = parseTimestamp(spans[0].value.min)
  const end = parseTimestamp(spans[0].value.max)
  if (start > end) {
    throw new Error('Timespan min must not exceed max.')
  }
  const errorFlag = variables.find(item => item.value.idShort === 'SimulateError')?.value.value
  if (errorFlag === 'true' || errorFlag === true) {
    return { executionState: 'Failed', success: false, messages: [{ messageType: 'Error', code: 'DEMO_ERROR', text: 'Simulated time-series service failure.' }] }
  }
  const value = samples.filter(sample => {
    const time = Date.parse(sample.timestamp)
    return time >= start && time <= end
  }).map(sample => ({
    modelType: 'SubmodelElementCollection',
    value: [
      { modelType: 'Property', idShort: 'Timestamp', valueType: 'xs:dateTime', value: sample.timestamp },
      { modelType: 'Property', idShort: 'Temperature', valueType: 'xs:double', value: sample.temperature },
      { modelType: 'Property', idShort: 'Unit', valueType: 'xs:string', value: '°C' },
    ],
  }))
  return {
    executionState: 'Completed', success: true, inoutputArguments: [],
    outputArguments: [{ value: { modelType: 'SubmodelElementList', idShort: 'Samples', typeValueListElement: 'SubmodelElementCollection', orderRelevant: true, value } }],
  }
}

export function executeReadRecords (input: unknown) {
  if (!Array.isArray(input)) {
    throw new TypeError('Expected an array of AAS OperationVariables.')
  }
  const bound = (idShort: string) => {
    const matches = input.filter(item => item?.value?.idShort === idShort)
    if (matches.length !== 1 || matches[0].value.modelType !== 'Property' || matches[0].value.valueType !== 'xs:dateTime') {
      throw new Error(`Exactly one ${idShort} Property<xs:dateTime> is required.`)
    }
    return matches[0].value.value
  }
  const result = execute([{ value: { idShort: 'Timespan', modelType: 'Range', valueType: 'xs:dateTime', min: bound('StartTime'), max: bound('EndTime') } }])
  return {
    executionState: 'Completed', success: true, inoutputArguments: [],
    outputArguments: [{ value: {
      idShort: 'Records', modelType: 'SubmodelElementCollection',
      value: result.outputArguments?.[0].value.value.map((record, index) => ({ ...record, idShort: `Record${index + 1}` })) ?? [],
    } }],
  }
}

export function createOperationServer () {
  return createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (request.method === 'GET' && request.url === '/health') {
      response.end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (request.method !== 'POST' || !['/timeseries', '/readrecords'].includes(request.url ?? '')) {
      response.writeHead(404).end(JSON.stringify({ message: 'Not found' }))
      return
    }
    try {
      let body = ''
      for await (const chunk of request) {
        body += chunk.toString()
        if (Buffer.byteLength(body) > 65_536) {
          response.writeHead(413).end(JSON.stringify({ message: 'Request too large' }))
          return
        }
      }
      const executeOperation = request.url === '/readrecords' ? executeReadRecords : execute
      response.end(JSON.stringify(executeOperation(JSON.parse(body))))
    } catch (error) {
      response.writeHead(400).end(JSON.stringify({ message: error instanceof Error ? error.message : 'Invalid request' }))
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createOperationServer().listen(8080, '0.0.0.0', () => console.log('Time-series operation service listening on :8080'))
}
