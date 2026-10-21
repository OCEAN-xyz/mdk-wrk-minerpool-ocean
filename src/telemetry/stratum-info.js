'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  await getClient().ready
  return getClient().datumCall('getStratumServerInfo', 'ERR_STRATUM_INFO_FETCH')
}
