'use strict'

const path = require('path')
const debug = require('debug')('mdk:worker:ocean:boot')
const WrkMinerPoolRackOcean = require('../workers/ocean.rack.minerpool.wrk')
const plugin = require('.')

const PKG_ROOT = path.join(__dirname, '..')
const DEFAULT_WTYPE = 'wrk-minerpool-rack-ocean'

function loadWorkerRuntime () {
  return require('@tetherto/mdk/backend/core/mdk-worker').WorkerRuntime
}

function stopWrk (wrk) {
  return new Promise((resolve) => wrk.stop(() => resolve()))
}

async function startOceanPoolWorker (opts) {
  if (!opts || !opts.workerId) throw new Error('ERR_WORKER_ID_REQUIRED')
  if (!opts.rack) throw new Error('ERR_RACK_REQUIRED')

  const WorkerRuntime = opts.WorkerRuntime || loadWorkerRuntime()

  const ctx = {
    ...(opts.ctx || {}),
    root: opts.root || PKG_ROOT,
    wtype: opts.wtype || DEFAULT_WTYPE,
    env: opts.env || 'production',
    rack: opts.rack,
    worker: path.join(PKG_ROOT, 'workers', 'ocean.rack.minerpool.wrk')
  }

  const wrk = new WrkMinerPoolRackOcean({}, ctx)
  await new Promise((resolve) => wrk.once('started', resolve))

  const services = { pool: wrk }
  let runtime
  try {
    runtime = new WorkerRuntime(plugin, {
      workerId: opts.workerId,
      kernelTopic: opts.kernelTopic || null,
      bootstrap: opts.bootstrap || null,
      store: wrk.store_s1,
      services,
      devices: [{ deviceId: opts.workerId, config: { pool: wrk } }]
    })
    await runtime.start()
  } catch (err) {
    await stopWrk(wrk)
    throw err
  }

  debug('ocean pool worker %s up (rack %s)', opts.workerId, opts.rack)

  return {
    runtime,
    pool: wrk,
    services,
    stop: async () => {
      await runtime.stop()
      await stopWrk(wrk)
    }
  }
}

module.exports = { startOceanPoolWorker }
