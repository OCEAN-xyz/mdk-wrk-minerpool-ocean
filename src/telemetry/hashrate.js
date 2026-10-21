'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  const { stats } = await getClient().ready
  return stats.reduce((sum, row) => sum + (row.hashrate || 0), 0)
}
