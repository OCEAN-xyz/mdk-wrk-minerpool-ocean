'use strict'

const { getClient } = require('../client')
const { inRange } = require('../history')

module.exports = async (params = {}) => {
  const client = getClient()
  await client.ready
  return inRange(client.history['alerts-history'], params)
}
