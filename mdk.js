'use strict'
process.env.TZ = 'UTC'

const { parseArgs } = require('util')
const { startOceanPoolWorker } = require('./plugin/boot')

const { values: args } = parseArgs({
  options: {
    wtype: { type: 'string', default: 'wrk-minerpool-rack-ocean' },
    env: { type: 'string', default: 'production' },
    rack: { type: 'string' },
    'worker-id': { type: 'string' },
    topic: { type: 'string' },
    'keys-dir': { type: 'string' }
  }
})

async function main () {
  if (!args.rack) throw new Error('ERR_RACK_REQUIRED: pass --rack')

  const workerId = args['worker-id'] || `${args.wtype}-${args.rack}`
  const worker = await startOceanPoolWorker({
    workerId,
    rack: args.rack,
    env: args.env,
    wtype: args.wtype,
    root: __dirname,
    kernelTopic: args.topic || null
  })

  const key = worker.runtime.getPublicKey().toString('hex')
  if (args['keys-dir']) {
    const { publishWorkerKey } = require('@tetherto/mdk/backend/core/mdk/lib/local-discovery')
    publishWorkerKey(args['keys-dir'], workerId, key)
  }
  console.log(`MDK worker ${workerId} ready, runtime key ${key}`)

  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    setTimeout(() => process.exit(1), 10000).unref()
    await worker.stop()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
