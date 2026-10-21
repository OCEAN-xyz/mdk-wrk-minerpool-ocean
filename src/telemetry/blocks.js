'use strict'

const { getClient } = require('../client')
const { inRange, poolBlocks, monthlyBlocks } = require('../history')

module.exports = async (params = {}) => {
  const client = getClient()
  await client.ready
  const rows = inRange(client.history.blocks, params)
  return params.aggrMonthly ? monthlyBlocks(rows) : poolBlocks(rows)
}
