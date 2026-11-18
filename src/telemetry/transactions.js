'use strict'

const { getClient } = require('../client')
const { aggregateTransactions } = require('../history')

module.exports = async (params = {}) => {
  // no `await client.ready`: transactions does not read the snapshot
  const rows = await getClient().transactions(params)
  return params.aggrHourly ? aggregateTransactions(rows, params) : rows
}
