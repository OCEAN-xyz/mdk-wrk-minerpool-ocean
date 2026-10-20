'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  await getClient().ready
  return getClient().datumCall('getDecentralizedClientStats', 'ERR_DATUM_CLIENT_STATS_FETCH')
}
