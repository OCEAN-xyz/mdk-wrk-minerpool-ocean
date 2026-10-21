'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  const client = getClient()
  await client.ready
  return { ts: client.statsData.ts, stats: client.statsData.stats }
}
