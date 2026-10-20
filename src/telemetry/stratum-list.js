'use strict'

const { getClient } = require('../client')

module.exports = async () => {
  await getClient().ready
  return getClient().datumCall('getStratumList', 'ERR_STRATUM_LIST_FETCH')
}
