'use strict'

const path = require('path')
const test = require('brittle')
const { createServer } = require('../../mock/server')
const WorkerRuntimeV2 = require('@tetherto/mdk/backend/core/mdk-worker/lib/worker-runtime-v2')
const { build } = require('@tetherto/mdk/backend/core/kernel/lib/protocol/envelope')
const { ACTIONS, MESSAGE_TYPES } = require('@tetherto/mdk/backend/core/kernel/lib/protocol/actions')

const WORKER_DIR = path.resolve(__dirname, '../..')

const request = (action, deviceId, payload = {}) => build({
  action,
  type: MESSAGE_TYPES.REQUEST,
  sender: 'runtime-v2-test',
  target: 'ocean-test',
  deviceId,
  payload
})

function freePort () {
  return new Promise((resolve, reject) => {
    const net = require('net')
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

test('WorkerRuntimeV2 serves ocean telemetry without credentials', async (t) => {
  const port = await freePort()
  const mock = createServer({ host: '127.0.0.1', port, delay: 0 })
  await mock.app.ready()

  const runtime = new WorkerRuntimeV2(WORKER_DIR, {
    workerId: 'ocean-test',
    env: { DATUM_USER: 'datum-user', DATUM_PASSWORD: 'datum-secret' },
    devices: [{
      deviceId: 'pool-0',
      config: {
        apiUrl: `http://127.0.0.1:${port}`,
        datumApiUrl: `http://127.0.0.1:${port}`,
        accounts: ['test'],
        apiRetry: 1
      }
    }]
  })
  t.teardown(async () => {
    await runtime.stop()
    await mock.stop()
  })
  await runtime.start()

  const identity = await runtime.handleRequest(request(ACTIONS.IDENTITY_REQUEST, null))
  t.is(identity.payload.workerId, 'ocean-test')
  t.is(identity.payload.devices[0].deviceId, 'pool-0')

  const capability = await runtime.handleRequest(request(ACTIONS.CAPABILITY_REQUEST, null))
  t.is(capability.payload.contract.metadata.provider, 'ocean')
  t.ok(capability.payload.contract.capabilities.telemetry.some((entry) => entry.name === 'health'))
  for (const entry of capability.payload.contract.capabilities.telemetry) {
    t.is(entry.handler, undefined, 'handler paths are stripped')
  }

  const hashrate = await runtime.handleRequest(request(ACTIONS.TELEMETRY_PULL, 'pool-0', {
    query: { type: 'hashrate' }
  }))
  t.is(hashrate.payload.name, 'hashrate')
  t.ok(hashrate.payload.value > 0)

  const health = await runtime.handleRequest(request(ACTIONS.TELEMETRY_PULL, 'pool-0', {
    query: { type: 'health' }
  }))
  const published = JSON.stringify(health.payload)
  t.absent(published.includes('datum-secret'))
  t.absent(published.includes('DATUM_PASSWORD'))
  t.ok(['OK', 'DEGRADED', 'OFFLINE'].includes(health.payload.value.status))

  const config = await runtime.handleRequest(request(ACTIONS.TELEMETRY_PULL, 'pool-0', {
    query: { type: 'datum_config' }
  }))
  t.absent(JSON.stringify(config.payload).includes('rpcpassword'))
  t.ok(config.payload.value.config.pool_address)

  const missing = await runtime.handleRequest(request(ACTIONS.TELEMETRY_PULL, 'pool-0', {
    query: { type: 'stats_history' }
  }))
  t.ok(/ERR_START_INVALID/.test(missing.payload.error))
})
