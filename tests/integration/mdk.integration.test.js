'use strict'

const test = require('brittle')
const fs = require('fs')
const os = require('os')
const path = require('path')
const net = require('net')
const createTestnet = require('hyperdht/testnet')
const { getKernel, waitForDiscovery, shutdown } = require('@tetherto/mdk/backend/core/mdk')
const { createRawMdkClient } = require('@tetherto/mdk/backend/core/client')
const { WorkerRuntimeV2 } = require('@tetherto/mdk/backend/core/mdk-worker')
const { createServer } = require('../../mock/server')

const WORKER_DIR = path.resolve(__dirname, '../..')
const WORKER_ID = 'ocean-mdk-it'
const DEVICE_ID = 'ocean-pool'
const ACCOUNT = 'test'

function freePort () {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

test('MDK: WorkerRuntimeV2 is READY and serves telemetry through the Kernel', { timeout: 120000 }, async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-mdk-it-'))
  t.teardown(() => fs.rmSync(tmp, { recursive: true, force: true }), { order: Infinity })

  const testnet = await createTestnet(3, t.teardown)
  const bootstrap = testnet.bootstrap
  const port = await freePort()
  const mock = createServer({ host: '127.0.0.1', port, delay: 0 })
  await mock.app.ready()
  t.teardown(() => mock.stop())

  const kernel = await getKernel({
    root: path.join(tmp, 'kernel'),
    keyFile: false,
    hrpc: { whitelist: [], bootstrap },
    discovery: { mode: 'local' }
  })
  t.teardown(() => shutdown(kernel))

  const runtime = new WorkerRuntimeV2(WORKER_DIR, {
    workerId: WORKER_ID,
    storeDir: path.join(tmp, 'worker'),
    bootstrap,
    devices: [{
      deviceId: DEVICE_ID,
      config: {
        apiUrl: `http://127.0.0.1:${port}`,
        accounts: [ACCOUNT],
        apiRetry: 1
      }
    }]
  })
  await runtime.start()
  t.teardown(() => runtime.stop())

  await kernel.registerWorker(runtime.getPublicKey())
  const found = await waitForDiscovery(kernel, { minWorkers: 1, timeoutMs: 30000 })
  const registered = found.find((worker) => worker.workerId === WORKER_ID)
  t.is(registered && registered.state, 'READY', 'Kernel accepted the worker')
  t.alike(registered && registered.deviceIds, [DEVICE_ID], 'pool device id is published')

  const client = createRawMdkClient({ hrpc: { key: kernel.getPublicKey(), bootstrap } })
  await client.connect({ warmup: true })
  t.teardown(() => client.close())

  const { capabilities } = await client.getCapabilities(DEVICE_ID)
  const names = capabilities.telemetry.map((entry) => entry.name)
  t.ok(names.includes('hashrate'), 'hashrate is published')
  t.ok(names.includes('health'), 'health override is published')
  t.absent(capabilities.telemetry[0].handler, 'handler paths are not published')
  t.alike(capabilities.commands, [], 'read-only worker')

  const channel = await client.pullTelemetry(DEVICE_ID, 'hashrate')
  t.is(channel.name, 'hashrate')
  t.ok(channel.value > 0, `hashrate ${channel.value}`)

  const workers = await client.pullTelemetry(DEVICE_ID, 'workers_online')
  t.is(workers.name, 'workers_online')
  t.ok(workers.value > 0, 'workers_online through the Kernel client')

  const balance = await client.pullTelemetry(DEVICE_ID, 'balance')
  t.is(balance.name, 'balance')
  t.ok(Number.isFinite(balance.value), 'balance through the Kernel client')

  const missing = await client.pullTelemetry(DEVICE_ID, { type: 'stats_history' })
  t.ok(String(missing.error).includes('ERR_START_INVALID'), 'history validation reaches the client')
})
