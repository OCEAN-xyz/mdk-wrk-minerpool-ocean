'use strict'

const { getClient } = require('../client')
const { inRange, aggregateStats } = require('../history')

module.exports = async (params = {}) => {
  const client = getClient()
  await client.ready
  const rows = inRange(client.history.stats, params)
  return params.interval ? aggregateStats(rows, params.interval) : rows
}
