'use strict'

const test = require('brittle')
const fs = require('fs')
const os = require('os')
const path = require('path')
const net = require('net')
const createTestnet = require('hyperdht/testnet')
const { getKernel, waitForDiscovery, shutdown } = require('@tetherto/mdk/backend/core/mdk')
const { createRawMdkClient } = require('@tetherto/mdk/backend/core/client')
const { createServer } = require('../../mock/server')
const { startOceanPoolWorker } = require('../../plugin/boot')
const { SCHEDULER_TIMES, POOL_TYPE } = require('../../workers/lib/constants')

const WORKER_ID = 'ocean-mdk-it'
const RACK = 'rack-mdk-it'
const ACCOUNT = 'mdk-it-account'

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

// Service root laid out like a worker.js deployment (config/, config/facs/),
// with the MiningOS RPC facility pointed at the testnet too.
function writeServiceRoot (root, { apiUrl, bootstrap }) {
  const write = (rel, data) => {
    const file = path.join(root, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  }
  write('config/common.json', { dir_log: 'logs', debug: 0 })
  write('config/ocean.json', { apiUrl, accounts: [ACCOUNT], apiRetry: 1 })
  write('config/facs/net.config.json', { r0: { allow: [], allowLocal: true, dhtOpts: { bootstrap } } })
  write('config/facs/store.config.json', {})
  write('config/facs/logging.config.json', { l0: { level: 'silent' } })
}

test('MDK: telemetry is served through the Kernel', { timeout: 120000 }, async (t) => {
  const cwd = process.cwd()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-mdk-it-'))
  const serviceRoot = path.join(tmp, 'service')
  const kernelRoot = path.join(tmp, 'kernel')
  t.teardown(() => fs.rmSync(tmp, { recursive: true, force: true }), { order: Infinity })

  const testnet = await createTestnet(3, t.teardown)
  const bootstrap = testnet.bootstrap

  const port = await freePort()
  const mock = createServer({ host: '127.0.0.1', port, delay: 0 })
  await mock.app.ready()
  t.teardown(() => mock.stop())

  writeServiceRoot(serviceRoot, { apiUrl: `http://127.0.0.1:${port}`, bootstrap })

  // worker.js keeps its stores relative to the working directory.
  process.chdir(serviceRoot)
  t.teardown(() => process.chdir(cwd))

  const kernel = await getKernel({
    root: kernelRoot,
    keyFile: false,
    hrpc: { whitelist: [], bootstrap },
    discovery: { mode: 'local' }
  })
  t.teardown(() => shutdown(kernel))

  const worker = await startOceanPoolWorker({
    workerId: WORKER_ID,
    rack: RACK,
    root: serviceRoot,
    env: 'test',
    bootstrap
  })
  t.teardown(() => worker.stop())
  worker.pool._logErr = () => {}

  t.ok(worker.pool.net_r0.rpcServer.publicKey, 'MiningOS RPC server still runs alongside the runtime')

  // Run the scheduled jobs once instead of waiting for the cron ticks:
  // workers first so the stats row picks up worker_count.
  await worker.pool.fetchData(SCHEDULER_TIMES._5M.key, new Date())
  await worker.pool.fetchData(SCHEDULER_TIMES._1M.key, new Date())
  const expectedWorkers = worker.pool.data.workersData.workers.length
  const expectedOnline = worker.pool.data.workersData.workers.filter((w) => w.online).length
  const [statsRow] = worker.pool.data.statsData.stats
  const expectedHashrate = statsRow.hashrate
  t.ok(expectedOnline < expectedWorkers, 'mock includes an idle worker')
  t.ok(expectedWorkers > 0, `mock reported ${expectedWorkers} workers`)
  t.ok(expectedHashrate > 0, `mock reported hashrate ${expectedHashrate}`)

  await kernel.registerWorker(worker.runtime.getPublicKey())
  const workers = await waitForDiscovery(kernel, { minWorkers: 1, timeoutMs: 30000 })
  const registered = workers.find((w) => w.workerId === WORKER_ID)
  t.is(registered && registered.state, 'READY', 'Kernel accepted the worker')
  t.alike(registered && registered.deviceIds, [WORKER_ID], 'one pool device, keyed by workerId')

  const client = createRawMdkClient({ hrpc: { key: kernel.getPublicKey(), bootstrap } })
  await client.connect()
  t.teardown(() => client.close())

  await t.test('capabilities publish the contract', async (st) => {
    const { capabilities } = await client.getCapabilities(WORKER_ID)
    const names = capabilities.telemetry.map((e) => e.name)
    st.alike(names, ['hashrate', 'workers_online', 'balance', 'estimated_earnings'])
    st.absent(capabilities.telemetry[0].handler, 'handler paths are not published')
    st.alike(capabilities.commands, [], 'read-only worker')
  })

  await t.test('metrics run every contract telemetry handler', async (st) => {
    const res = await client.pullTelemetry(WORKER_ID, 'metrics')
    const { metrics } = res
    st.ok(metrics, 'metrics in the response')
    st.is(metrics.hashrate, expectedHashrate)
    st.is(metrics.workers_online, expectedOnline)
    st.is(metrics.balance, statsRow.balance)
    st.is(metrics.estimated_earnings, statsRow.estimated_earn_next_block)
  })

  await t.test('single telemetry channel', async (st) => {
    const res = await client.pullTelemetry(WORKER_ID, 'workers_online')
    st.is(res.name, 'workers_online')
    st.is(res.value, expectedOnline)
  })

  await t.test('ext_data reaches getWrkExtData', async (st) => {
    const stats = await client.pullTelemetry(WORKER_ID, { type: 'ext_data', key: 'stats' })
    const extData = stats.extData
    st.is(extData.stats.length, 1)
    st.is(extData.stats[0].username, ACCOUNT)
    st.is(extData.stats[0].poolType, POOL_TYPE)

    const list = await client.pullTelemetry(WORKER_ID, { type: 'ext_data', key: 'workers', limit: 5 })
    st.is(list.extData.workers.length, Math.min(5, expectedWorkers))

    const bad = await client.pullTelemetry(WORKER_ID, { type: 'ext_data' })
    st.ok(String(bad.error).includes('ERR_KEY_INVALID'), 'worker errors come back in the response')
  })
})
