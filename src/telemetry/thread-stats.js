'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  await getClient().ready
  return getClient().datumCall('getThreadStats', 'ERR_THREAD_STATS_FETCH')
}
