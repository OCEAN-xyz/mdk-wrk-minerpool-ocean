'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  const { stats } = await getClient().ready
  return stats.reduce((sum, row) => sum + (row.estimated_earn_next_block || 0), 0)
}
