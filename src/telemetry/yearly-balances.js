'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  const client = getClient()
  await client.ready
  const rows = []
  for (const username of client.accounts) {
    rows.push({ username, balances: await client.yearlyBalances(username) })
  }
  return rows
}
