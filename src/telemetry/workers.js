'use strict'

const { getClient } = require('../client')
const { inRange } = require('../history')
const { POOL_TYPE } = require('../lib/constants')

function page (workers, params) {
  const offset = Number(params.offset) || 0
  const limit = Math.min(Number(params.limit) || 100, 100)
  const named = params.name ? workers.filter((worker) => worker.name === params.name) : workers
  return named.slice(offset, offset + limit).map((worker) => ({ poolType: POOL_TYPE, ...worker }))
}

module.exports = async (params = {}) => {
  const client = getClient()
  await client.ready
  if (params.start == null && params.end == null) {
    return { ts: client.workersData.ts, workers: page(client.workersData.workers, params) }
  }
  return inRange(client.history.workers, params).map((row) => ({
    ts: row.ts,
    workers: page(row.workers, params)
  }))
}
