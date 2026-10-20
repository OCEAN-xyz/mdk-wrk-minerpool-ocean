'use strict'

const { getClient } = require('../client')
const { inRange, aggregateTransactions } = require('../history')

module.exports = async (params = {}) => {
  const client = getClient()
  await client.ready
  const rows = inRange(client.history.transactions, params)
  return params.aggrHourly ? aggregateTransactions(rows, params) : rows
}
