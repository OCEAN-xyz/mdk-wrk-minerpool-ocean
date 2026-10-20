'use strict'

const test = require('brittle')
const path = require('path')
const { createServer } = require('../../mock/server')
const { createInstance } = require('@tetherto/mdk/backend/core/mdk-worker/lib/instance-loader')

const PKG = path.join(__dirname, '../..')
const ACCOUNT = 'test'

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

test('contract worker: telemetry pull and invalid history range', async (t) => {
  const port = await freePort()
  const mock = createServer({ host: '127.0.0.1', port, delay: 0 })
  await mock.app.ready()
  t.teardown(() => mock.stop())

  const contract = require('../../mdk-contract.json')
  const device = Object.freeze({
    id: 'ocean-pool-1',
    opts: Object.freeze({
      apiUrl: `http://127.0.0.1:${port}`,
      accounts: [ACCOUNT],
      apiRetry: 1
    }),
    env: Object.freeze({}),
    config: Object.freeze({}),
    workerId: 'ocean-mdk-worker-test',
    logger: () => {}
  })
  const entries = {
    telemetry: new Map(contract.capabilities.telemetry.map((entry) => [entry.name, path.join(PKG, entry.handler)])),
    commands: new Map()
  }
  const instance = createInstance({ dir: PKG, entries, device })

  const hashrate = await instance.telemetry.get('hashrate')()
  const workers = await instance.telemetry.get('workers_online')()
  const balance = await instance.telemetry.get('balance')()
  const estimated = await instance.telemetry.get('estimated_earnings')()
  const stats = await instance.telemetry.get('stats')()

  t.ok(hashrate > 0, `hashrate ${hashrate}`)
  t.ok(workers > 0, `workers_online ${workers}`)
  t.ok(Number.isFinite(balance), 'balance is a number')
  t.ok(Number.isFinite(estimated), 'estimated earnings is a number')
  t.is(stats.stats[0].username, ACCOUNT)
  t.is(stats.stats[0].poolType, 'ocean')

  await t.exception(
    () => instance.telemetry.get('stats_history')({}),
    /ERR_START_INVALID/
  )
  await t.exception(
    () => instance.telemetry.get('transactions')({ start: 0 }),
    /ERR_END_INVALID/
  )

  const now = Date.now()
  const history = await instance.telemetry.get('stats_history')({ start: now - 60_000, end: now + 60_000 })
  t.ok(Array.isArray(history), 'stats_history returns an array')
  t.ok(history.length >= 1, 'refresh stored a stats sample')

  await t.exception(
    () => instance.telemetry.get('datum_client_stats')(),
    /ERR_DATUM_NOT_CONFIGURED/
  )
})
